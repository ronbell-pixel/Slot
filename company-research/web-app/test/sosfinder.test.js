import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sosSearch, trimResponse, clearSosCache } from '../src/sosfinder.js';
import { runRegistryTool } from '../src/research.js';
import { systemPrompt } from '../src/prompt.js';

process.env.SOS_API_KEY = 'test-key';

const apiResponse = {
  state: 'FL', stateName: 'Florida', success: true, query: 'Acme LLC', searchBy: 'name', count: 2,
  bestMatch: {
    name: 'ACME LLC', entityId: 'L19000123456', status: 'Active', entityType: 'Florida Limited Liability Company',
    formationDate: '04/08/2019', feiEin: '59-1234567', registeredAgentName: 'Jane Doe', mailingAddress: null,
    officers: Array.from({ length: 20 }, (_, i) => ({ name: `Officer ${i}`, title: 'MGR', address: '' })),
    documents: [{ title: 'ANNUAL REPORT', url: 'https://example.com/a.pdf' }], filings: [],
    raw: { huge: 'x'.repeat(10000) }, sosUrl: 'https://search.sunbiz.org/example',
  },
  results: [
    { name: 'ACME LLC', entityId: 'L19000123456', status: 'Active' },
    { name: 'ACME HOLDINGS LLC', entityId: 'L20000999', status: 'Inactive', raw: {} },
  ],
  error: null, blocked: false,
};

function stubFetch(responses) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url: String(url), headers: opts.headers });
    const r = responses.shift();
    return { ok: r.status === 200, status: r.status, json: async () => r.body };
  };
  fn.calls = calls;
  return fn;
}

beforeEach(() => clearSosCache());

test('trimResponse drops raw payloads and empty fields, caps lists, de-duplicates the best match', () => {
  const t = trimResponse(apiResponse);
  assert.equal(t.bestMatch.name, 'ACME LLC');
  assert.equal(t.bestMatch.feiEin, '59-1234567');
  assert.equal(t.bestMatch.raw, undefined);
  assert.equal('mailingAddress' in t.bestMatch, false);
  assert.equal('filings' in t.bestMatch, false);
  assert.equal(t.bestMatch.officers.length, 15);
  assert.deepEqual(t.similar.map((s) => s.name), ['ACME HOLDINGS LLC']);
  assert.ok(JSON.stringify(t).length < 3000);
});

test('sosSearch sends the key server-side, maps ID searches, and caches results', async () => {
  const f = stubFetch([{ status: 200, body: apiResponse }]);
  const first = await sosSearch({ state: 'FL', query: 'L19000123456', search_by: 'documentNumber' }, { fetchImpl: f });
  assert.equal(first.bestMatch.entityId, 'L19000123456');
  assert.equal(f.calls[0].headers['x-api-key'], 'test-key');
  const url = new URL(f.calls[0].url);
  assert.equal(url.searchParams.get('state'), 'FL');
  assert.equal(url.searchParams.get('by'), 'documentNumber');
  const second = await sosSearch({ state: 'fl', query: 'l19000123456', search_by: 'documentNumber' }, { fetchImpl: f });
  assert.equal(second.cached, true);
  assert.equal(f.calls.length, 1);
});

test('blocked responses are not cached; HTTP errors become readable errors', async () => {
  const f = stubFetch([
    { status: 200, body: { ...apiResponse, success: false, bestMatch: null, results: [], blocked: true } },
    { status: 200, body: apiResponse },
    { status: 402, body: {} },
    { status: 401, body: {} },
  ]);
  assert.equal((await sosSearch({ state: 'TX', query: 'Acme' }, { fetchImpl: f })).blocked, true);
  assert.equal((await sosSearch({ state: 'TX', query: 'Acme' }, { fetchImpl: f })).blocked, false);
  assert.match((await sosSearch({ state: 'TX', query: 'Other' }, { fetchImpl: f })).error, /quota/);
  assert.match((await sosSearch({ state: 'TX', query: 'Third' }, { fetchImpl: f })).error, /API key/);
});

test('runRegistryTool enforces the per-report limit and validates input', async () => {
  const limited = await runRegistryTool({ state: 'TX', query: 'Acme', search_by: 'name' }, { used: 3 });
  assert.match(limited.result.error, /limit/);
  assert.equal(limited.charged, false);
  const invalid = await runRegistryTool({ state: '', query: 'Acme' }, { used: 0 });
  assert.equal(invalid.charged, false);
});

test('system prompt switches registry instructions on the tool being available', () => {
  assert.match(systemPrompt({ registry: true }), /Call state_registry_search first/);
  assert.doesNotMatch(systemPrompt({ registry: false }), /state_registry_search/);
  assert.doesNotMatch(systemPrompt({ registry: true }), /\{\{/);
});
