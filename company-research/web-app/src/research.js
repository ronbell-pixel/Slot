import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { REPORT_SCHEMA, validateReport, normalizeReport } from './schema.js';
import { systemPrompt, buildUserMessage } from './prompt.js';
import { sosSearch, sosConfigured, SEARCH_BY } from './sosfinder.js';
import { addUsage } from './usage.js';

// Two research depths: "standard" (default, cheapest) and "thorough", chosen per lookup.
export const MODELS = {
  standard: process.env.CLAUDE_MODEL || 'claude-haiku-5-5',
  thorough: process.env.CLAUDE_MODEL_THOROUGH || 'claude-sonnet-5-5',
};
export const modelFor = (depth) => MODELS[depth] ?? MODELS.standard;
const EFFORT = process.env.CLAUDE_EFFORT || 'medium';
const MAX_SEARCHES = Number(process.env.MAX_WEB_SEARCHES || 12);
const MAX_FETCHES = Number(process.env.MAX_WEB_FETCHES || 8);
const SOS_MAX_CALLS = Number(process.env.SOS_MAX_CALLS_PER_LOOKUP || 3);
// registry calls, pause_turn resumes, plus at most one nudge to call the report tool
const MAX_ROUNDS = 10;

const REPORT_TOOL = 'submit_company_report';
const REGISTRY_TOOL = 'state_registry_search';

// The newer web tools (dynamic filtering) and server-side refusal fallback are only
// available on some models; Haiku uses the basic web tools and runs without fallback.
const dynamicWeb = (model) => /^claude-(opus-(5-5|5|4-8|4-7|4-6)|sonnet-(5-5|5|4-6))$/.test(model);
const serverFallback = (model) => /^claude-(opus-5-5|opus-5|sonnet-5-5|fable-5-1)$/.test(model);

const webTools = (model) => [
  { type: dynamicWeb(model) ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search', max_uses: MAX_SEARCHES },
  { type: dynamicWeb(model) ? 'web_fetch_20260209' : 'web_fetch_20250910', name: 'web_fetch', max_uses: MAX_FETCHES },
];

const REGISTRY_TOOL_DEF = {
  name: REGISTRY_TOOL,
  description:
    'Search an official U.S. Secretary of State business registry (all 50 states and DC) and get the normalized record: ' +
    'status/standing, entity type, formation date, registered agent, addresses, officers (where the state publishes them), ' +
    'filings, documents and the official registry URL (sosUrl). Returns the best match plus similar filings. ' +
    `Each call uses a paid credit: at most ${SOS_MAX_CALLS} calls per lookup, so search the most likely state first ` +
    'and use search_by with the entityId from a result for an exact follow-up.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['state', 'query', 'search_by'],
    properties: {
      state: { type: 'string', description: 'Two-letter state code, e.g. TX.' },
      query: { type: 'string', description: 'Business name, or the registry ID when search_by is not "name".' },
      search_by: {
        type: 'string',
        enum: SEARCH_BY,
        description: 'Use "name" normally. Registry ID fields: entityId (NY, CA), documentNumber (FL), fileNumber (DE), filingNumber (AR), controlNumber (GA).',
      },
    },
  },
  strict: true,
  eager_input_streaming: true,
};

const REPORT_TOOL_DEF = {
  name: REPORT_TOOL,
  description: 'Submit the finished company research report. Call exactly once, after research is complete.',
  input_schema: REPORT_SCHEMA,
  // The full report schema is too large for strict mode's compiled grammar, so the
  // server validates it instead and gives Claude one chance to fix a bad submission.
  strict: process.env.STRICT_TOOL === 'true',
  eager_input_streaming: true,
};

const toolsFor = (model, registry) => [...webTools(model), ...(registry ? [REGISTRY_TOOL_DEF] : []), REPORT_TOOL_DEF];

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
export async function researchCompany(input, opts = {}) {
  if (process.env.MOCK_REPORT_FILE) return mockResearch(opts.onProgress ?? (() => {}), modelFor(input.depth));
  // Usage and registry credits are tracked even when a lookup fails, so the usage log is complete.
  const spend = { usage: {}, registryCalls: 0, model: modelFor(input.depth) };
  try {
    return await runResearch(input, opts, spend);
  } catch (err) {
    err.spend = spend;
    throw err;
  }
}

async function runResearch(input, { onProgress = () => {}, signal } = {}, spend) {
  const registry = sosConfigured();
  const model = modelFor(input.depth);
  const tools = toolsFor(model, registry);
  const system = systemPrompt({ registry });
  const messages = [{ role: 'user', content: buildUserMessage(input) }];
  let nudged = false;
  let resubmitted = false;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = getClient().beta.messages.stream(
      {
        model,
        max_tokens: 64000,
        ...(serverFallback(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
        thinking: { type: 'adaptive' },
        output_config: { effort: EFFORT },
        cache_control: { type: 'ephemeral' },
        system,
        tools,
        messages,
      },
      { signal },
    );

    stream.on('contentBlock', (block) => {
      if (block.type === 'server_tool_use' && block.name === 'web_search') {
        onProgress({ type: 'search', message: `Searching: ${block.input?.query ?? ''}` });
      } else if (block.type === 'server_tool_use' && block.name === 'web_fetch') {
        onProgress({ type: 'fetch', message: `Reading: ${block.input?.url ?? ''}` });
      } else if (block.type === 'tool_use' && block.name === REGISTRY_TOOL) {
        onProgress({ type: 'registry', message: `Checking ${block.input?.state ?? ''} state registry: ${block.input?.query ?? ''}` });
      } else if (block.type === 'tool_use' && block.name === REPORT_TOOL) {
        onProgress({ type: 'phase', message: 'Compiling report' });
      }
    });

    const response = await stream.finalMessage();
    addUsage(spend.usage, response.usage);

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
      const report = normalizeReport(call.input);
      const problems = validateReport(report);
      if (problems.length && !resubmitted) {
        resubmitted = true;
        onProgress({ type: 'phase', message: 'Fixing report format' });
        messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: call.id,
            is_error: true,
            content: `The report is incomplete: ${problems.slice(0, 10).join('; ')}. Call ${REPORT_TOOL} again with every required field (use empty strings for unknown values).`,
          }],
        });
        continue;
      }
      if (problems.length) {
        throw new ResearchError(`The report came back incomplete (${problems.slice(0, 3).join('; ')}). Try again.`, {
          code: 'invalid_report',
        });
      }
      return {
        report,
        meta: {
          model: response.model,
          checked_at: new Date().toISOString(),
          usage: spend.usage,
          registry_calls: spend.registryCalls,
          depth: input.depth === 'thorough' ? 'thorough' : 'standard',
        },
      };
    }

    const registryUses = response.content.filter((b) => b.type === 'tool_use' && b.name === REGISTRY_TOOL);
    if (response.stop_reason === 'tool_use' && registryUses.length) {
      // All results go back in one user message so parallel calls keep working.
      const results = [];
      for (const use of registryUses) {
        const output = await runRegistryTool(use.input, { signal, used: spend.registryCalls });
        if (output.charged) spend.registryCalls++;
        onProgress({ type: 'registry', message: output.summary });
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(output.result),
          ...(output.result.error ? { is_error: true } : {}),
        });
      }
      messages.push({ role: 'user', content: results });
      continue;
    }

    if (nudged) break;
    nudged = true;
    messages.push({
      role: 'user',
      content: `Call ${REPORT_TOOL} now with your findings. Use an empty string for anything you could not confirm.`,
    });
  }

  throw new ResearchError('Research finished without producing a report. Try again.', { code: 'no_report' });
}

export async function runRegistryTool(input, { signal, used }) {
  const state = typeof input?.state === 'string' ? input.state.trim() : '';
  const query = typeof input?.query === 'string' ? input.query.trim() : '';
  const searchBy = SEARCH_BY.includes(input?.search_by) ? input.search_by : 'name';
  if (!state || !query) {
    return { result: { error: 'state and query are required.' }, summary: 'Registry: invalid request', charged: false };
  }
  if (used >= SOS_MAX_CALLS) {
    return {
      result: { error: `Registry lookup limit (${SOS_MAX_CALLS}) reached for this report. Continue with web search.` },
      summary: 'Registry: lookup limit reached, using web search',
      charged: false,
    };
  }
  const result = await sosSearch({ state, query: query.slice(0, 200), search_by: searchBy }, { signal });
  let summary;
  if (result.error) summary = `Registry unavailable: ${result.error}`;
  else if (result.blocked) summary = `Registry: ${state} registry temporarily blocked, using web search`;
  else if (result.bestMatch) summary = `Registry match: ${result.bestMatch.name}${result.bestMatch.status ? ` (${result.bestMatch.status})` : ''}`;
  else summary = `Registry: no ${state} match for "${query}"`;
  // Cached answers aren't billed again by SOS Finder, so they don't count toward the limit.
  return { result, summary, charged: !result.cached && !result.error };
}

// Local preview without an API key: MOCK_REPORT_FILE=test/fixtures/sample-report.json npm start
async function mockResearch(onProgress, model) {
  const steps = ['Checking TX state registry: Acme Example Widgets', 'Registry match: ACME EXAMPLE WIDGETS, LLC (Active)', 'Searching: Acme Example Widgets Austin TX', 'Reading: https://www.example.com', 'Compiling report'];
  for (const message of steps) {
    await new Promise((r) => setTimeout(r, 400));
    onProgress({ type: /^(Checking|Registry)/.test(message) ? 'registry' : message.startsWith('Reading') ? 'fetch' : message.startsWith('Searching') ? 'search' : 'phase', message });
  }
  const report = JSON.parse(await readFile(process.env.MOCK_REPORT_FILE, 'utf8'));
  return { report, meta: { model, checked_at: new Date().toISOString(), usage: {}, registry_calls: 1, depth: model.includes('sonnet') ? 'thorough' : 'standard' } };
}
