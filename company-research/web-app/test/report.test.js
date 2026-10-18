import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { REPORT_SCHEMA, validateReport, IDENTIFICATION_FIELDS } from '../src/schema.js';
import { buildUserMessage, cleanInput, SYSTEM_PROMPT } from '../src/prompt.js';
import { RateLimiter } from '../src/rate-limit.js';
import { reportAsText, statusTone } from '../public/report-format.js';
import { buildDocDefinition, pdfFilename } from '../public/pdf.js';

const sample = JSON.parse(await readFile(new URL('./fixtures/sample-report.json', import.meta.url), 'utf8'));

test('sample report passes validation', () => {
  assert.deepEqual(validateReport(sample), []);
});

test('validation catches missing and malformed fields', () => {
  const broken = structuredClone(sample);
  delete broken.sources;
  delete broken.identification.legal_name;
  broken.confidence = 'Very high';
  const problems = validateReport(broken);
  assert.ok(problems.includes('missing sources'));
  assert.ok(problems.includes('missing identification.legal_name'));
  assert.ok(problems.some((p) => p.startsWith('confidence')));
  assert.deepEqual(validateReport(null), ['report is not an object']);
});

test('every schema object is closed and lists all its properties as required (strict tool use)', () => {
  const walk = (node, path) => {
    if (node?.type === 'object' || (Array.isArray(node?.type) && node.type.includes('object'))) {
      assert.equal(node.additionalProperties, false, `${path} additionalProperties`);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), `${path} required`);
      for (const [k, v] of Object.entries(node.properties)) walk(v, `${path}.${k}`);
    }
    if (node?.items) walk(node.items, `${path}[]`);
  };
  walk(REPORT_SCHEMA, 'report');
  assert.equal(Object.keys(REPORT_SCHEMA.properties.identification.properties).length, IDENTIFICATION_FIELDS.length);
});

test('user message carries inputs, purpose and date; system prompt stays static', () => {
  const msg = buildUserMessage({ company: 'Acme', state: 'TX', purpose: 'credit' }, new Date('2026-10-18T12:00:00Z'));
  assert.match(msg, /Today's date: 2026-10-18/);
  assert.match(msg, /Company name: Acme/);
  assert.match(msg, /State: TX/);
  assert.match(msg, /Credit application intake/);
  assert.doesNotMatch(SYSTEM_PROMPT, /\d{4}-\d{2}-\d{2}/);
});

test('cleanInput trims, drops unknown keys and caps length', () => {
  const out = cleanInput({ company: '  Acme  ', evil: 'x', city: '', notes: 'n'.repeat(5000) });
  assert.deepEqual(Object.keys(out).sort(), ['company', 'notes']);
  assert.equal(out.company, 'Acme');
  assert.equal(out.notes.length, 1000);
});

test('rate limiter allows up to the limit per window', () => {
  let now = 0;
  const rl = new RateLimiter({ limit: 2, windowMs: 1000, now: () => now });
  assert.ok(rl.take('a'));
  assert.ok(rl.take('a'));
  assert.ok(!rl.take('a'));
  assert.ok(rl.take('b'));
  now = 1001;
  assert.ok(rl.take('a'));
});

test('text export and PDF definition include key facts', () => {
  const entry = { report: sample, meta: { checked_at: '2026-10-18T12:00:00Z' }, input: { company: 'Acme' } };
  const text = reportAsText(entry);
  assert.match(text, /Legal Name: Acme Example Widgets, LLC \[1\]/);
  assert.match(text, /Tax ID \/ EIN: Not found/);
  const doc = buildDocDefinition(entry);
  assert.equal(doc.pageSize, 'LETTER');
  assert.match(JSON.stringify(doc.content), /Acme Example Widgets, LLC/);
  assert.match(pdfFilename(entry), /^NextWin-Research-Acme-Example-Widgets-LLC-\d{4}-\d{2}-\d{2}\.pdf$/);
});

test('status tone', () => {
  assert.equal(statusTone('Active'), 'good');
  assert.equal(statusTone('Forfeited Existence'), 'bad');
  assert.equal(statusTone('Inactive'), 'bad');
  assert.equal(statusTone('Pending'), 'warn');
});

test('strict schema stays under the API limit of 16 union-typed fields', () => {
  let unions = 0;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.type) || node.anyOf) unions++;
    Object.values(node.properties || {}).forEach(walk);
    if (node.items) walk(node.items);
  };
  walk(REPORT_SCHEMA);
  assert.ok(unions <= 16, `${unions} union-typed fields`);
});

test('normalizeReport turns empty strings into null and drops empty list items', async () => {
  const { normalizeReport } = await import('../src/schema.js');
  const out = normalizeReport({ a: { value: '  ', source_ids: [] }, b: ['x', ''], c: 'keep', n: 3 });
  assert.deepEqual(out, { a: { value: null, source_ids: [] }, b: ['x'], c: 'keep', n: 3 });
});
