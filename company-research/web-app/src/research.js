import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { REPORT_SCHEMA, validateReport } from './schema.js';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.CLAUDE_EFFORT || 'medium';
const MAX_SEARCHES = Number(process.env.MAX_WEB_SEARCHES || 12);
const MAX_FETCHES = Number(process.env.MAX_WEB_FETCHES || 8);
// pause_turn resumes plus at most one nudge to call the report tool
const MAX_ROUNDS = 6;

const REPORT_TOOL = 'submit_company_report';

const TOOLS = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: MAX_SEARCHES },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: MAX_FETCHES },
  {
    name: REPORT_TOOL,
    description: 'Submit the finished company research report. Call exactly once, after research is complete.',
    input_schema: REPORT_SCHEMA,
    strict: process.env.STRICT_TOOL !== 'false',
    eager_input_streaming: true,
  },
];

let client;
const getClient = () => (client ??= new Anthropic());

export class ResearchError extends Error {
  constructor(message, { status = 500, code = 'research_failed' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Runs one company lookup. `onProgress` receives {type, message} events
 * (searches, page fetches, phase changes) for the live progress view.
 */
export async function researchCompany(input, { onProgress = () => {}, signal } = {}) {
  if (process.env.MOCK_REPORT_FILE) return mockResearch(onProgress);
  const messages = [{ role: 'user', content: buildUserMessage(input) }];
  let nudged = false;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = getClient().beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: EFFORT },
        cache_control: { type: 'ephemeral' },
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      },
      { signal },
    );

    stream.on('contentBlock', (block) => {
      if (block.type === 'server_tool_use' && block.name === 'web_search') {
        onProgress({ type: 'search', message: `Searching: ${block.input?.query ?? ''}` });
      } else if (block.type === 'server_tool_use' && block.name === 'web_fetch') {
        onProgress({ type: 'fetch', message: `Reading: ${block.input?.url ?? ''}` });
      } else if (block.type === 'tool_use' && block.name === REPORT_TOOL) {
        onProgress({ type: 'phase', message: 'Compiling report' });
      }
    });

    const response = await stream.finalMessage();

    if (response.stop_reason === 'refusal') {
      throw new ResearchError('The research request was declined. Try rephrasing the company details.', {
        status: 422,
        code: 'refused',
      });
    }

    // Append the whole assistant turn unchanged (thinking and server-tool blocks included).
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'pause_turn') {
      onProgress({ type: 'phase', message: 'Continuing research' });
      continue;
    }

    if (response.stop_reason === 'max_tokens') {
      throw new ResearchError('The report was cut off before it finished. Try again.', { code: 'truncated' });
    }

    const call = response.content.find((b) => b.type === 'tool_use' && b.name === REPORT_TOOL);
    if (call) {
      const problems = validateReport(call.input);
      if (problems.length) {
        throw new ResearchError(`The report came back incomplete (${problems.slice(0, 3).join('; ')}). Try again.`, {
          code: 'invalid_report',
        });
      }
      return {
        report: call.input,
        meta: {
          model: response.model,
          checked_at: new Date().toISOString(),
          usage: response.usage,
        },
      };
    }

    if (nudged) break;
    nudged = true;
    messages.push({
      role: 'user',
      content: `Call ${REPORT_TOOL} now with your findings. Use null for anything you could not confirm.`,
    });
  }

  throw new ResearchError('Research finished without producing a report. Try again.', { code: 'no_report' });
}

// Local preview without an API key: MOCK_REPORT_FILE=test/fixtures/sample-report.json npm start
async function mockResearch(onProgress) {
  const steps = ['Searching: Texas Secretary of State business search', 'Reading: https://www.example.com', 'Compiling report'];
  for (const message of steps) {
    await new Promise((r) => setTimeout(r, 400));
    onProgress({ type: message.startsWith('Reading') ? 'fetch' : message.startsWith('Searching') ? 'search' : 'phase', message });
  }
  const report = JSON.parse(await readFile(process.env.MOCK_REPORT_FILE, 'utf8'));
  return { report, meta: { model: 'mock', checked_at: new Date().toISOString(), usage: null } };
}
