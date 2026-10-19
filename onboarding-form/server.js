import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SECTIONS } from './public/questions.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 3000;
const { RESEND_API_KEY, NOTIFY_EMAIL, ADMIN_CODE } = process.env;
const FROM_EMAIL = process.env.FROM_EMAIL || 'NextWin AI Onboarding <onboarding@resend.dev>';
const MAX_BODY = 200_000;
const MAX_FIELD = 5_000;

const FIELDS = new Map(SECTIONS.flatMap(s => s.fields.map(f => [f.id, f])));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

// Simple per-IP limiter: 10 submissions per hour.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 3_600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Keep only known fields, trimmed and length-capped.
function clean(input) {
  const out = {};
  for (const [id, f] of FIELDS) {
    let v = input[id];
    if (f.type === 'many') {
      v = Array.isArray(v) ? v.filter(o => f.options.includes(o)) : [];
      if (v.length) out[id] = v;
    } else if (typeof v === 'string' && v.trim()) {
      v = v.trim().slice(0, MAX_FIELD);
      if (f.type === 'one' && !f.options.includes(v)) continue;
      out[id] = v;
    }
  }
  return out;
}

function renderHtml(answers, meta) {
  const sections = SECTIONS.map(s => {
    const rows = s.fields.filter(f => answers[f.id]).map(f => {
      const v = Array.isArray(answers[f.id]) ? answers[f.id].join(', ') : answers[f.id];
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;color:#646B7A;width:38%;vertical-align:top;font-size:13px">${esc(f.label)}</td>`
        + `<td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;color:#0A1017;font-size:14px;white-space:pre-wrap">${esc(v)}</td></tr>`;
    }).join('');
    return rows ? `<h2 style="font:600 15px system-ui,sans-serif;color:#028071;margin:28px 0 8px;border-bottom:2px solid #0A1017;padding-bottom:6px">${esc(s.title)}</h2>`
      + `<table style="width:100%;border-collapse:collapse;font-family:system-ui,sans-serif">${rows}</table>` : '';
  }).join('');
  return `<div style="max-width:720px;margin:auto;font-family:system-ui,sans-serif">`
    + `<p style="margin:0 0 18px;font:800 18px system-ui,sans-serif;color:#0A1017;letter-spacing:-.02em">NextWin <span style="color:#646B7A">AI</span>`
    + `<span style="display:block;font:500 10px ui-monospace,monospace;letter-spacing:.2em;color:#028071;margin-top:3px">WORK FLOWS. BUSINESS GROWS.</span></p>`
    + `<h1 style="font-size:22px;color:#0A1017;margin:0 0 4px">New client questionnaire: ${esc(answers.business_name || 'Unnamed')}</h1>`
    + `<p style="color:#646B7A;margin:0">Submitted ${esc(meta.at)} · ID ${esc(meta.id)}</p>${sections}</div>`;
}

function renderText(answers) {
  return SECTIONS.map(s => {
    const lines = s.fields.filter(f => answers[f.id]).map(f => `${f.label}: ${[].concat(answers[f.id]).join(', ')}`);
    return lines.length ? `== ${s.title} ==\n${lines.join('\n')}` : '';
  }).filter(Boolean).join('\n\n');
}

async function sendEmail(answers, meta) {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) return { skipped: true };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL.split(',').map(s => s.trim()),
      reply_to: answers.contact_email,
      subject: `New client questionnaire: ${answers.business_name || 'Unnamed'}`,
      html: renderHtml(answers, meta),
      text: renderText(answers),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return { sent: true };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

async function handleSubmit(req, res) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (limited(ip)) return json(res, 429, { error: 'Too many submissions — please try again later.' });
  let input;
  try { input = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'Invalid submission.' }); }
  if (input.website) return json(res, 200, { ok: true }); // honeypot: bots fill hidden fields
  const answers = clean(input);
  if (!answers.business_name || !answers.contact_name || !/^\S+@\S+\.\S+$/.test(answers.contact_email || '')) {
    return json(res, 400, { error: 'Please fill in business name, your name and a valid email.' });
  }
  const meta = { id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString() };
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, `${meta.at.replace(/[:.]/g, '-')}_${meta.id}.json`), JSON.stringify({ ...meta, answers }, null, 2));
  try { await sendEmail(answers, meta); } catch (e) { console.error('email failed', meta.id, e.message); }
  json(res, 200, { ok: true });
}

// Backup view of every saved submission: /admin?code=ADMIN_CODE
async function handleAdmin(req, res, url) {
  const given = Buffer.from(url.searchParams.get('code') || '');
  const want = Buffer.from(ADMIN_CODE || '');
  if (!ADMIN_CODE || given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    res.writeHead(404); return res.end('Not found');
  }
  const files = (await fs.readdir(DATA_DIR).catch(() => [])).filter(f => f.endsWith('.json')).sort().reverse();
  const items = await Promise.all(files.map(async f => JSON.parse(await fs.readFile(path.join(DATA_DIR, f), 'utf8'))));
  const body = items.length ? items.map(s => renderHtml(s.answers, s)).join('<hr style="margin:40px 0;border:0;border-top:1px dashed #ccc">') : '<p>No submissions yet.</p>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Submissions</title><body style="padding:24px;background:#fff">${body}`);
}

async function serveStatic(res, pathname) {
  const file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC)) { res.writeHead(404); return res.end(); }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/health') return json(res, 200, { ok: true });
    if (url.pathname === '/api/submit' && req.method === 'POST') return await handleSubmit(req, res);
    if (url.pathname === '/admin') return await handleAdmin(req, res, url);
    if (req.method === 'GET') return await serveStatic(res, url.pathname);
    res.writeHead(405); res.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Something went wrong — please try again.' });
  }
}).listen(PORT, () => console.log(`onboarding form on :${PORT}`));
