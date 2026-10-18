import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { researchCompany, ResearchError } from './src/research.js';
import { cleanInput } from './src/prompt.js';
import { RateLimiter } from './src/rate-limit.js';
import { sosConfigured } from './src/sosfinder.js';
import { parseAccessCodes, identify, safeEqual } from './src/access.js';
import { UsageLog, estimateClaudeCost } from './src/usage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const USERS = parseAccessCodes();
const ADMIN_CODE = process.env.ADMIN_CODE || '';
const MONTHLY_LIMIT = Number(process.env.USER_MONTHLY_LIMIT || 0);
const usageLog = await new UsageLog().load();
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

const userFor = (req) => identify(req.headers['x-access-code'], USERS);
const adminOk = (req) => Boolean(ADMIN_CODE) && safeEqual(req.headers['x-admin-code'] || '', ADMIN_CODE);

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/config', async () => ({
  accessCodeRequired: USERS.length > 0,
  apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  registryConnected: sosConfigured() || Boolean(process.env.MOCK_REPORT_FILE),
}));

app.post('/api/verify-access', async (req, reply) => {
  const user = userFor(req);
  if (!user) return reply.code(401).send({ error: 'Incorrect access code.' });
  return {
    ok: true,
    user,
    monthlyLimit: MONTHLY_LIMIT || null,
    usedThisMonth: usageLog.monthCount(user),
  };
});

// Usage page data (public/admin.html), protected by ADMIN_CODE.
app.get('/api/admin/usage', async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ error: ADMIN_CODE ? 'Incorrect admin code.' : 'ADMIN_CODE is not set.' });
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
  return {
    ...usageLog.summary(month === 'all' ? null : month),
    months: usageLog.months(),
    persistent: Boolean(process.env.DATA_DIR),
    monthlyLimit: MONTHLY_LIMIT || null,
  };
});

app.get('/api/admin/usage.csv', async (req, reply) => {
  if (!adminOk(req)) return reply.code(401).send({ error: 'Incorrect admin code.' });
  const cols = ['ts', 'user', 'company', 'state', 'purpose', 'status', 'registryCalls', 'claudeCost', 'error'];
  const cell = (v) => {
    const t = v === undefined || v === null ? '' : String(v);
    // Quote, and neutralize spreadsheet formulas in user-entered text.
    return `"${(/^[=+\-@]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
  };
  const csv = [cols.join(','), ...usageLog.records.map((r) => cols.map((c) => cell(c === 'claudeCost' ? r[c]?.toFixed(4) : r[c])).join(','))].join('\n');
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', 'attachment; filename="nextwin-research-usage.csv"');
  return csv;
});

// Streams progress as Server-Sent Events, then a final `report` (or `error`) event.
app.post('/api/research', async (req, reply) => {
  const user = userFor(req);
  if (!user) return reply.code(401).send({ error: 'Incorrect access code.' });

  const input = cleanInput(req.body);
  if (!input.company) return reply.code(400).send({ error: 'Company name is required.' });

  if (MONTHLY_LIMIT && usageLog.monthCount(user) >= MONTHLY_LIMIT) {
    return reply.code(429).send({ error: `You've used all ${MONTHLY_LIMIT} lookups for this month. Ask your administrator for more.` });
  }
  if (!limiter.take(user === 'Open access' ? req.ip : `user:${user}`)) {
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
    req.log.info({ user, company: input.company, usage: result.meta.usage }, 'research complete');
    await logUsage(user, input, 'ok', result.meta.usage, result.meta.registry_calls);
    send('report', { input, ...result });
  } catch (err) {
    const status = abort.signal.aborted ? 'cancelled' : 'failed';
    await logUsage(user, input, status, err.spend?.usage, err.spend?.registryCalls, status === 'failed' ? userMessage(err) : null);
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

async function logUsage(user, input, status, usage = {}, registryCalls = 0, error = null) {
  try {
    await usageLog.add({
      user,
      company: input.company,
      state: input.state || null,
      purpose: input.purpose || 'both',
      status,
      registryCalls: registryCalls || 0,
      claudeCost: Number(estimateClaudeCost(usage).toFixed(4)),
      tokens: usage,
      error,
    });
  } catch (err) {
    app.log.error(err, 'could not write usage log');
  }
}

function userMessage(err) {
  if (err instanceof ResearchError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return 'The server is missing a valid Anthropic API key.';
  if (err instanceof Anthropic.RateLimitError) return 'The research service is busy. Wait a minute and try again.';
  if (err instanceof Anthropic.APIError && err.status >= 500) return 'The research service had a temporary problem. Try again.';
  if (err instanceof Anthropic.APIError) return `Research request failed (${err.status}).`;
  return 'Something went wrong while researching. Try again.';
}

app.listen({ port: PORT, host: '0.0.0.0' });
