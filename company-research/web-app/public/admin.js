const KEY = 'nextwin.research.admin';
const $ = (id) => document.getElementById(id);
const money = (n) => `$${(n || 0).toFixed(2)}`;
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

let code = '';
try { code = sessionStorage.getItem(KEY) || ''; } catch { /* storage unavailable */ }

async function load(month) {
  const q = month ? `?month=${encodeURIComponent(month)}` : '';
  const r = await fetch(`/api/admin/usage${q}`, { headers: { 'x-admin-code': code } });
  if (r.status === 401) {
    const body = await r.json().catch(() => ({}));
    return { error: body.error || 'Incorrect admin code.' };
  }
  if (!r.ok) return { error: `Could not load usage (${r.status}).` };
  return r.json();
}

function cell(text, cls) {
  const td = document.createElement('td');
  td.textContent = text;
  if (cls) td.className = cls;
  return td;
}

function render(data) {
  $('t-lookups').textContent = data.totals.lookups;
  $('t-failed').textContent = data.totals.failed;
  $('t-credits').textContent = data.totals.registryCredits;
  $('t-cost').textContent = money(data.totals.claudeCost);
  $('persist-note').hidden = data.persistent;

  const current = new Date().toISOString().slice(0, 7);
  const months = [...new Set([current, ...data.months])];
  const select = $('month');
  const selected = data.month;
  select.replaceChildren(
    ...months.map((m) => new Option(new Date(`${m}-15`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), m)),
    new Option('All time', 'all'),
  );
  select.value = selected;

  $('people').replaceChildren(...(data.users.length ? data.users.map((u) => {
    const tr = document.createElement('tr');
    tr.append(cell(u.user), cell(u.lookups, 'num'), cell(u.failed, 'num'), cell(u.registryCredits, 'num'), cell(money(u.claudeCost), 'num'), cell(when(u.lastUsed)));
    return tr;
  }) : [Object.assign(document.createElement('tr'), { innerHTML: '<td colspan="6" class="muted">No lookups yet.</td>' })]));

  $('limit-note').hidden = !data.monthlyLimit;
  if (data.monthlyLimit) $('limit-note').textContent = `Each person can run ${data.monthlyLimit} lookups per month (USER_MONTHLY_LIMIT).`;

  $('recent').replaceChildren(...data.recent.map((r) => {
    const tr = document.createElement('tr');
    tr.append(cell(when(r.ts)), cell(r.user), cell(r.company), cell(r.state || '—'),
      cell(r.depth === 'thorough' ? 'Thorough' : r.depth === 'standard' ? 'Standard' : '—'),
      cell(r.status === 'ok' ? 'Report' : r.status, `status-${r.status === 'ok' ? 'ok' : r.status}`),
      cell(r.registryCalls || 0, 'num'), cell(money(r.claudeCost), 'num'));
    return tr;
  }));
}

async function open(month) {
  const data = await load(month);
  if (data.error) {
    $('admin').hidden = true;
    $('gate').hidden = false;
    $('gate-error').textContent = data.error;
    $('gate-error').hidden = !code;
    return;
  }
  $('gate').hidden = true;
  $('admin').hidden = false;
  render(data);
}

$('gate-form').addEventListener('submit', (e) => {
  e.preventDefault();
  code = $('gate-code').value.trim();
  try { sessionStorage.setItem(KEY, code); } catch { /* storage unavailable */ }
  open();
});

$('month').addEventListener('change', (e) => open(e.target.value));

$('lock').addEventListener('click', () => {
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  location.reload();
});

$('csv').addEventListener('click', async () => {
  const r = await fetch('/api/admin/usage.csv', { headers: { 'x-admin-code': code } });
  if (!r.ok) return;
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: 'nextwin-research-usage.csv' });
  a.click();
  URL.revokeObjectURL(url);
});

if (code) open(); else $('gate-code').focus();
