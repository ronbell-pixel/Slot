import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseAccessCodes, identify } from '../src/access.js';
import { UsageLog, addUsage, estimateClaudeCost } from '../src/usage.js';

test('parses per-person codes plus the shared team code', () => {
  const users = parseAccessCodes({ ACCESS_CODES: 'Ron=nw-1; Jane Doe = nw-2\nbad-entry;=nocode;Sam=', ACCESS_CODE: 'team-x' });
  assert.deepEqual(users, [
    { name: 'Ron', code: 'nw-1' },
    { name: 'Jane Doe', code: 'nw-2' },
    { name: 'Team', code: 'team-x' },
  ]);
});

test('identify maps codes to people and rejects wrong codes', () => {
  const users = parseAccessCodes({ ACCESS_CODES: 'Ron=nw-1;Jane=nw-2', ACCESS_CODE: '' });
  assert.equal(identify('nw-2', users), 'Jane');
  assert.equal(identify('nw-3', users), null);
  assert.equal(identify('', users), null);
  assert.equal(identify(undefined, []), 'Open access');
});

test('usage totals add across rounds and price out', () => {
  const total = {};
  addUsage(total, { input_tokens: 1_000_000, output_tokens: 0, server_tool_use: { web_search_requests: 3 } });
  addUsage(total, { input_tokens: 0, output_tokens: 100_000, cache_read_input_tokens: 1_000_000 });
  assert.equal(total.input_tokens, 1_000_000);
  assert.equal(total.web_search_requests, 3);
  // $4 input + $2 output + $0.20 cache read + $0.03 searches
  assert.equal(estimateClaudeCost(total).toFixed(2), '6.23');
});

test('usage log persists, counts per month and summarizes per person', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'usage-'));
  const log = new UsageLog(dir);
  await log.add({ user: 'Ron', company: 'A', status: 'ok', registryCalls: 1, claudeCost: 0.5 });
  await log.add({ user: 'Ron', company: 'B', status: 'failed', registryCalls: 0, claudeCost: 0.1 });
  await log.add({ user: 'Jane', company: 'C', status: 'ok', registryCalls: 2, claudeCost: 0.7 });
  const reloaded = await new UsageLog(dir).load();
  assert.equal(reloaded.records.length, 3);
  assert.equal(reloaded.monthCount('Ron'), 2);
  const s = reloaded.summary(new Date().toISOString().slice(0, 7));
  assert.equal(s.users[0].user, 'Ron');
  assert.equal(s.users[0].failed, 1);
  assert.equal(s.totals.registryCredits, 3);
  assert.equal(s.totals.claudeCost.toFixed(1), '1.3');
  assert.equal(s.recent[0].company, 'C');
});
