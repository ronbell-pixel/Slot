import { IDENTIFICATION_FIELDS, PROFILE_FIELDS } from './report-fields.js';
import { downloadPdf } from './pdf.js';
import { reportAsText, matchLabel, statusTone, formatDate, registryLabel } from './report-format.js';

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','PR'];
const HISTORY_KEY = 'nextwin.research.history';
const CODE_KEY = 'nextwin.research.code';
const HISTORY_MAX = 20;

const $ = (id) => document.getElementById(id);
const el = {
  gate: $('gate'), gateForm: $('gate-form'), gateCode: $('gate-code'), gateError: $('gate-error'),
  app: $('app'), form: $('search-form'), submit: $('submit-btn'), state: $('state-select'),
  empty: $('empty'), progress: $('progress'), progressTitle: $('progress-title'), log: $('progress-log'),
  cancel: $('cancel-btn'), error: $('error'), errorText: $('error-text'), report: $('report'),
  history: $('history'), clearHistory: $('clear-history'), registryStatus: $('registry-status'),
  userBar: $('user-bar'), userName: $('user-name'), userUsage: $('user-usage'), switchUser: $('switch-user'),
};

// ---------- storage (per-browser convenience only) ----------
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } },
};

let accessCode = store.get(CODE_KEY) || '';
let controller = null;

for (const s of STATES) el.state.add(new Option(s, s));

function loadHistory() {
  try { return JSON.parse(store.get(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(items) {
  // Drop the oldest entries if storage is full.
  for (let n = items.length; n > 0; n--) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, n))); return; } catch { /* try fewer */ }
  }
}

// ---------- access gate ----------
let config = { accessCodeRequired: false };
let session = null; // { user, monthlyLimit, usedThisMonth } once a code is accepted

async function init() {
  try { config = await (await fetch('/api/config')).json(); } catch { /* assume open */ }
  if (config.accessCodeRequired) {
    session = await verify(accessCode);
    if (!session) {
      el.gate.hidden = false;
      el.gateCode.focus();
      return;
    }
  }
  showApp();
}

async function verify(code) {
  if (!code) return null;
  const r = await fetch('/api/verify-access', { method: 'POST', headers: { 'x-access-code': code } });
  return r.ok ? r.json() : null;
}

el.gateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = el.gateCode.value.trim();
  const result = await verify(code);
  if (result) {
    accessCode = code;
    session = result;
    store.set(CODE_KEY, code);
    el.gate.hidden = true;
    showApp();
  } else {
    el.gateError.textContent = 'That code is not correct.';
    el.gateError.hidden = false;
  }
});

el.switchUser.addEventListener('click', () => {
  store.remove(CODE_KEY);
  location.reload();
});

function renderUser() {
  if (!session?.user) return;
  const used = session.monthlyLimit
    ? ` · ${session.usedThisMonth} of ${session.monthlyLimit} lookups this month`
    : ` · ${session.usedThisMonth} lookup${session.usedThisMonth === 1 ? '' : 's'} this month`;
  el.userName.textContent = session.user;
  el.userUsage.textContent = used;
  el.userBar.hidden = false;
}

function showApp() {
  el.app.hidden = false;
  renderUser();
  if (config.registryConnected) {
    el.registryStatus.textContent = 'State registry data connected (SOS Finder)';
    el.registryStatus.hidden = false;
  }
  renderHistory();
}

// ---------- research ----------
el.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = Object.fromEntries(new FormData(el.form).entries());
  await runResearch(input);
});

el.cancel.addEventListener('click', () => controller?.abort());

async function runResearch(input) {
  controller = new AbortController();
  showOnly('progress');
  el.log.replaceChildren();
  el.progressTitle.textContent = `Researching ${input.company}…`;
  el.submit.disabled = true;

  try {
    const res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-access-code': accessCode },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) { store.remove(CODE_KEY); location.reload(); return; }
      throw new Error(body.error || `Request failed (${res.status}).`);
    }
    let finished = false;
    for await (const { event, data } of readEvents(res.body)) {
      if (event === 'progress') addLog(data);
      else if (event === 'error') throw new Error(data.error);
      else if (event === 'report') {
        finished = true;
        if (session) { session.usedThisMonth++; renderUser(); }
        const entry = { id: Date.now(), ...data };
        saveHistory([entry, ...loadHistory()].slice(0, HISTORY_MAX));
        renderHistory();
        showReport(entry);
      }
    }
    if (!finished) throw new Error('The connection closed before the report arrived. Try again.');
  } catch (err) {
    if (err.name === 'AbortError') showOnly(el.report.childElementCount ? 'report' : 'empty');
    else showError(err.message);
  } finally {
    el.submit.disabled = false;
    controller = null;
  }
}

async function* readEvents(body) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (data) yield { event, data: JSON.parse(data) };
    }
  }
}

function addLog({ type, message }) {
  const li = document.createElement('li');
  li.className = type;
  li.textContent = message;
  el.log.append(li);
  el.log.scrollTop = el.log.scrollHeight;
}

function showOnly(name) {
  for (const key of ['empty', 'progress', 'error', 'report']) el[key].hidden = key !== name;
}

function showError(message) {
  el.errorText.textContent = message;
  showOnly('error');
}

// ---------- report rendering ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

function cites(ids) {
  return (ids || []).map((id) => `<a class="cite" href="#src-${esc(id)}">[${esc(id)}]</a>`).join('');
}

function facts(section, defs) {
  return `<dl class="facts">${defs.map(([key, label]) => {
    const f = section?.[key];
    const value = f?.value;
    if (key === 'website' && safeUrl(value)) {
      return `<div class="fact"><dt>${esc(label)}</dt><dd><a href="${esc(value)}" target="_blank" rel="noopener">${esc(value)}</a>${cites(f.source_ids)}</dd></div>`;
    }
    return `<div class="fact"><dt>${esc(label)}</dt>${value
      ? `<dd>${esc(value)}${cites(f.source_ids)}</dd>`
      : '<dd class="missing">Not found</dd>'}</div>`;
  }).join('')}</dl>`;
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function registryBadge(check) {
  const label = registryLabel(check);
  if (!label) return '';
  const tone = check.outcome === 'match' && check.method !== 'not_checked' ? 'good' : 'warn';
  return `<span class="badge ${tone}">${esc(label)}</span>`;
}

function registryLink(check) {
  const url = safeUrl(check?.registry_url);
  if (!url && !check?.entity_id) return '';
  const id = check.entity_id ? `Registry ID ${esc(check.entity_id)}` : 'Registry record';
  return `<p class="registry-link">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${id} — view official record</a>` : id}</p>`;
}

function showReport(entry) {
  const { report: r, meta, input } = entry;
  const id = r.identification || {};
  const name = id.legal_name?.value || input.company;
  const status = id.entity_status?.value;
  const confTone = { High: 'good', Medium: 'warn', Low: 'bad' }[r.confidence] || '';

  const sections = [];
  sections.push(`
    <div class="card">
      <div class="report-head">
        <div>
          <h2>${esc(name)}</h2>
          <div class="report-sub">${esc(r.input_summary)} · Checked ${esc(formatDate(meta?.checked_at))}</div>
        </div>
        <div class="report-actions">
          <button class="btn primary small" data-action="pdf" type="button">Download PDF</button>
          <button class="btn ghost small" data-action="copy" type="button">Copy text</button>
        </div>
      </div>
      <div class="badges">
        <span class="badge ${confTone}">Confidence: ${esc(r.confidence)}</span>
        <span class="badge">${esc(matchLabel(r.match_status))}</span>
        ${registryBadge(r.registry_check)}
        ${status ? `<span class="badge ${statusTone(status)}">Status: ${esc(status)}</span>` : ''}
        ${r.risk_flags?.length ? `<span class="badge warn">${r.risk_flags.length} flag${r.risk_flags.length > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="section"><h3>Business summary</h3><p class="summary-text">${esc(r.business_summary)}</p></div>
    </div>`);

  sections.push(`<div class="card"><div class="section" style="margin-top:0"><h3>Company identification</h3>${facts(id, IDENTIFICATION_FIELDS)}</div></div>`);

  if (r.risk_flags?.length) {
    sections.push(`<div class="card"><div class="section" style="margin-top:0"><h3>Verification flags</h3><ul class="flags">${
      r.risk_flags.map((f) => `<li class="flag ${esc(f.severity)}"><b>${esc(f.flag)}${cites(f.source_ids)}</b><span>${esc(f.detail)}</span></li>`).join('')}</ul></div></div>`);
  }

  sections.push(`<div class="card"><div class="section" style="margin-top:0"><h3>Secretary of State findings</h3><p class="summary-text">${esc(r.registry_findings)}</p>${registryLink(r.registry_check)}</div>
    ${r.candidates?.length ? `<div class="section"><h3>Other possible matches</h3>${table(['Name', 'State', 'Status', 'Why'],
      r.candidates.map((c) => [esc(c.name), esc(c.state || '—'), esc(c.status || '—'), esc(c.reason)]))}</div>` : ''}</div>`);

  sections.push(`<div class="card"><div class="section" style="margin-top:0"><h3>Company profile</h3>${facts(r.profile, PROFILE_FIELDS)}</div>
    ${r.people?.length ? `<div class="section"><h3>Officers &amp; key people</h3>${table(['Name', 'Title', 'Business contact'],
      r.people.map((p) => [esc(p.name) + cites(p.source_ids), esc(p.title || '—'), esc(p.business_contact || '—')]))}</div>` : ''}
    <div class="section"><h3>Professional licenses</h3>${r.licenses?.length ? table(['License', 'Issuer', 'Number', 'Status', 'Expires'],
      r.licenses.map((l) => [esc(l.type) + cites(l.source_ids), esc(l.issuer || '—'), esc(l.number || '—'), esc(l.status || '—'), esc(l.expiration || '—')]))
      : '<p class="muted">No professional licenses found in public sources.</p>'}</div></div>`);

  const pr = r.prospecting || {};
  if (pr.recent_news?.length || pr.talking_points?.length || pr.social_profiles?.length) {
    sections.push(`<div class="card">
      ${pr.talking_points?.length ? `<div class="section" style="margin-top:0"><h3>Talking points</h3><ul class="plain-list">${pr.talking_points.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      ${pr.recent_news?.length ? `<div class="section"><h3>Recent news</h3><ul class="plain-list">${pr.recent_news.map((n) => `<li>${n.date ? `<b>${esc(n.date)}</b> · ` : ''}${esc(n.headline)}${cites(n.source_ids)}</li>`).join('')}</ul></div>` : ''}
      ${pr.social_profiles?.length ? `<div class="section"><h3>Online profiles</h3><ul class="plain-list">${pr.social_profiles.map((s) => {
        const u = safeUrl(s.url);
        return `<li>${esc(s.network)}: ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>` : esc(s.url)}</li>`;
      }).join('')}</ul></div>` : ''}
    </div>`);
  }

  sections.push(`<div class="card">
    <div class="section" style="margin-top:0"><h3>Source confidence: ${esc(r.confidence)}</h3><p class="summary-text">${esc(r.confidence_rationale)}</p></div>
    ${r.notes?.length ? `<div class="section"><h3>Notes &amp; exceptions</h3><ul class="plain-list">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
    <div class="section"><h3>Sources</h3><ol class="sources">${(r.sources || []).map((s) => {
      const u = safeUrl(s.url);
      return `<li id="src-${esc(s.id)}" value="${esc(s.id)}">${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(s.title || u)}</a>` : esc(s.title)}<span class="kind">${esc(String(s.kind || '').replace('_', ' '))}</span></li>`;
    }).join('')}</ol></div>
    <p class="report-meta">AI-generated by NextWin AI Company Research on ${esc(formatDate(meta?.checked_at))}. Verify all information using the cited sources.</p>
  </div>`);

  el.report.innerHTML = sections.join('');
  el.report.className = 'content';
  el.report.querySelector('[data-action="pdf"]').addEventListener('click', (ev) => onPdf(ev.currentTarget, entry));
  el.report.querySelector('[data-action="copy"]').addEventListener('click', (ev) => onCopy(ev.currentTarget, entry));
  showOnly('report');
  el.report.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function onPdf(btn, entry) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    await downloadPdf(entry);
  } catch (err) {
    console.error(err);
    alert('Could not build the PDF in this browser. Use your browser’s Print → Save as PDF instead.');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

async function onCopy(btn, entry) {
  try {
    await navigator.clipboard.writeText(reportAsText(entry));
    btn.textContent = 'Copied';
  } catch {
    btn.textContent = 'Copy failed';
  }
  setTimeout(() => { btn.textContent = 'Copy text'; }, 1800);
}

// ---------- history ----------
function renderHistory() {
  const items = loadHistory();
  el.clearHistory.hidden = !items.length;
  el.history.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    const name = item.report?.identification?.legal_name?.value || item.input?.company || 'Unknown';
    const nm = document.createElement('span');
    nm.className = 'h-name';
    nm.textContent = name;
    const meta = document.createElement('span');
    meta.className = 'h-meta';
    meta.textContent = [item.input?.state, formatDate(item.meta?.checked_at), item.report?.confidence && `${item.report.confidence} confidence`].filter(Boolean).join(' · ');
    b.append(nm, meta);
    b.addEventListener('click', () => showReport(item));
    li.append(b);
    return li;
  }));
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = 'No lookups yet.';
    el.history.append(li);
  }
}

el.clearHistory.addEventListener('click', () => {
  if (confirm('Clear saved lookups from this browser?')) {
    store.remove(HISTORY_KEY);
    renderHistory();
  }
});

init();
