import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Usage log: one JSON line per lookup in DATA_DIR/usage.jsonl. On Railway,
// DATA_DIR points at a mounted volume so the log survives redeploys.

// List prices in USD per million tokens, plus the web search fee. Estimates only;
// the Anthropic Console has the authoritative bill.
const MODEL_PRICES = {
  opus: { input: 4, output: 20, cacheRead: 0.2 },
  sonnet: { input: 2, output: 10, cacheRead: 0.2 },
  haiku: { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
const PER_SEARCH = 0.01;

export function priceFor(model = process.env.CLAUDE_MODEL || 'claude-opus-5-5') {
  const family = Object.keys(MODEL_PRICES).find((f) => model.includes(f)) ?? 'opus';
  const p = MODEL_PRICES[family];
  return { ...p, cacheWrite: p.input * 1.25 };
}

export function estimateClaudeCost(u = {}, model) {
  const p = priceFor(model);
  const m = 1e6;
  return (
    ((u.input_tokens || 0) * p.input) / m +
    ((u.output_tokens || 0) * p.output) / m +
    ((u.cache_creation_input_tokens || 0) * p.cacheWrite) / m +
    ((u.cache_read_input_tokens || 0) * p.cacheRead) / m +
    (u.web_search_requests || 0) * PER_SEARCH
  );
}

/** Adds one response's usage into a running total. */
export function addUsage(total, u) {
  if (!u) return total;
  for (const key of ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) {
    total[key] = (total[key] || 0) + (u[key] || 0);
  }
  total.web_search_requests = (total.web_search_requests || 0) + (u.server_tool_use?.web_search_requests || 0);
  total.web_fetch_requests = (total.web_fetch_requests || 0) + (u.server_tool_use?.web_fetch_requests || 0);
  return total;
}

export class UsageLog {
  constructor(dir = process.env.DATA_DIR || path.resolve('data')) {
    this.file = path.join(dir, 'usage.jsonl');
    this.dir = dir;
    this.records = [];
  }

  async load() {
    try {
      const text = await readFile(this.file, 'utf8');
      this.records = text.split('\n').filter(Boolean).flatMap((line) => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    return this;
  }

  async add(record) {
    const row = { ts: new Date().toISOString(), ...record };
    this.records.push(row);
    await mkdir(this.dir, { recursive: true });
    await appendFile(this.file, JSON.stringify(row) + '\n');
    return row;
  }

  /** Lookups by `user` in the calendar month (UTC) containing `now`. */
  monthCount(user, now = new Date()) {
    const month = now.toISOString().slice(0, 7);
    return this.records.filter((r) => r.user === user && r.ts.startsWith(month)).length;
  }

  months() {
    return [...new Set(this.records.map((r) => r.ts.slice(0, 7)))].sort().reverse();
  }

  summary(month) {
    const rows = this.records.filter((r) => !month || r.ts.startsWith(month));
    const byUser = new Map();
    for (const r of rows) {
      const u = byUser.get(r.user) ?? { user: r.user, lookups: 0, failed: 0, registryCredits: 0, claudeCost: 0, lastUsed: null };
      u.lookups++;
      if (r.status !== 'ok') u.failed++;
      u.registryCredits += r.registryCalls || 0;
      u.claudeCost += r.claudeCost || 0;
      if (!u.lastUsed || r.ts > u.lastUsed) u.lastUsed = r.ts;
      byUser.set(r.user, u);
    }
    const users = [...byUser.values()].sort((a, b) => b.lookups - a.lookups);
    const totals = users.reduce(
      (t, u) => ({
        lookups: t.lookups + u.lookups,
        failed: t.failed + u.failed,
        registryCredits: t.registryCredits + u.registryCredits,
        claudeCost: t.claudeCost + u.claudeCost,
      }),
      { lookups: 0, failed: 0, registryCredits: 0, claudeCost: 0 },
    );
    return { month: month || 'all', users, totals, recent: rows.slice(-50).reverse() };
  }
}
