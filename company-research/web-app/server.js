import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { researchCompany, ResearchError } from './src/research.js';
import { cleanInput } from './src/prompt.js';
import { RateLimiter } from './src/rate-limit.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const limiter = new RateLimiter({
  limit: Number(process.env.RATE_LIMIT_PER_HOUR || 30),
  windowMs: 60 * 60 * 1000,
});

const app = Fastify({ logger: true, trustProxy: true });

await app.register(fastifyStatic, { root: path.join(here, 'public') });
await app.register(fastifyStatic, {
  root: path.join(here, 'node_modules/pdfmake/build'),
  prefix: '/vendor/pdfmake/',
  decorateReply: false,
});

function accessOk(req) {
  if (!ACCESS_CODE) return true;
  const given = Buffer.from(String(req.headers['x-access-code'] || ''));
  const expected = Buffer.from(ACCESS_CODE);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/config', async () => ({
  accessCodeRequired: Boolean(ACCESS_CODE),
  apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
}));

app.post('/api/verify-access', async (req, reply) => {
  if (!accessOk(req)) return reply.code(401).send({ error: 'Incorrect access code.' });
  return { ok: true };
});

// Streams progress as Server-Sent Events, then a final `report` (or `error`) event.
app.post('/api/research', async (req, reply) => {
  if (!accessOk(req)) return reply.code(401).send({ error: 'Incorrect access code.' });

  const input = cleanInput(req.body);
  if (!input.company) return reply.code(400).send({ error: 'Company name is required.' });

  if (!limiter.take(req.ip)) {
    return reply.code(429).send({ error: 'Hourly lookup limit reached. Try again later.' });
  }

  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  // Keep proxies from closing the connection during long searches.
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000);

  const abort = new AbortController();
  res.on('close', () => abort.abort());

  send('progress', { type: 'phase', message: 'Starting research' });
  try {
    const result = await researchCompany(input, {
      signal: abort.signal,
      onProgress: (p) => send('progress', p),
    });
    req.log.info({ company: input.company, usage: result.meta.usage }, 'research complete');
    send('report', { input, ...result });
  } catch (err) {
    if (abort.signal.aborted) {
      req.log.info('client disconnected');
    } else {
      req.log.error(err);
      send('error', { error: userMessage(err) });
    }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

function userMessage(err) {
  if (err instanceof ResearchError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return 'The server is missing a valid Anthropic API key.';
  if (err instanceof Anthropic.RateLimitError) return 'The research service is busy. Wait a minute and try again.';
  if (err instanceof Anthropic.APIError && err.status >= 500) return 'The research service had a temporary problem. Try again.';
  if (err instanceof Anthropic.APIError) return `Research request failed (${err.status}).`;
  return 'Something went wrong while researching. Try again.';
}

app.listen({ port: PORT, host: '0.0.0.0' });
