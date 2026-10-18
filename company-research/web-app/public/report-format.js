import { IDENTIFICATION_FIELDS, PROFILE_FIELDS } from './report-fields.js';

const MATCH_LABELS = {
  confident_match: 'Confident match',
  probable_match: 'Probable match',
  multiple_candidates: 'Multiple candidates',
  not_found: 'No registry match found',
};

export const matchLabel = (status) => MATCH_LABELS[status] || 'Match unclear';

/** Short label for how the state registry was checked, or '' for reports made before this existed. */
export function registryLabel(check) {
  if (!check) return '';
  if (check.outcome === 'match' && check.method === 'registry_api') return 'Verified via state registry';
  if (check.outcome === 'match' && check.method === 'web_search') return 'State registry checked (web)';
  if (check.outcome === 'no_match') return 'No state registry match';
  return 'State registry not verified';
}

export function statusTone(status = '') {
  const s = status.toLowerCase();
  if (/(dissolv|revok|forfeit|inactive|terminat|withdrawn|cancel|suspend|delinquent)/.test(s)) return 'bad';
  if (/(active|good standing|current|in existence)/.test(s)) return 'good';
  return 'warn';
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const refs = (ids) => (ids?.length ? ` [${ids.join(', ')}]` : '');

/** Plain-text version of a report, in the same order as the PEAC-style summary. */
export function reportAsText({ report: r, meta, input }) {
  const out = [];
  const line = (s = '') => out.push(s);
  line('COMPANY IDENTIFICATION SUMMARY — NextWin AI Company Research');
  line(`Checked: ${formatDate(meta?.checked_at)}`);
  line();
  line(`Input provided: ${r.input_summary || input?.company || ''}`);
  line(`Match: ${matchLabel(r.match_status)} · Source confidence: ${r.confidence}${registryLabel(r.registry_check) ? ` · ${registryLabel(r.registry_check)}` : ''}`);
  line();
  line('MOST LIKELY MATCH');
  for (const [key, label] of IDENTIFICATION_FIELDS) {
    const f = r.identification?.[key];
    line(`${label}: ${f?.value ?? 'Not found'}${refs(f?.source_ids)}`);
  }
  line();
  line(`Business summary: ${r.business_summary}`);
  line();
  line('PROFILE');
  for (const [key, label] of PROFILE_FIELDS) {
    const f = r.profile?.[key];
    line(`${label}: ${f?.value ?? 'Not found'}${refs(f?.source_ids)}`);
  }
  if (r.people?.length) {
    line();
    line('OFFICERS & KEY PEOPLE');
    for (const p of r.people) line(`- ${p.name}${p.title ? `, ${p.title}` : ''}${p.business_contact ? ` (${p.business_contact})` : ''}${refs(p.source_ids)}`);
  }
  line();
  line('PROFESSIONAL LICENSES');
  if (r.licenses?.length) {
    for (const l of r.licenses) line(`- ${l.type}${l.issuer ? ` — ${l.issuer}` : ''}${l.number ? ` #${l.number}` : ''}${l.status ? ` (${l.status})` : ''}${l.expiration ? `, expires ${l.expiration}` : ''}${refs(l.source_ids)}`);
  } else {
    line('None found in public sources.');
  }
  line();
  line(`SECRETARY OF STATE FINDINGS: ${r.registry_findings}`);
  if (r.registry_check?.entity_id || r.registry_check?.registry_url) {
    line(`Registry record: ${[r.registry_check.entity_id && `ID ${r.registry_check.entity_id}`, r.registry_check.registry_url].filter(Boolean).join(' — ')}`);
  }
  if (r.candidates?.length) {
    line();
    line('OTHER POSSIBLE MATCHES');
    for (const c of r.candidates) line(`- ${c.name} (${[c.state, c.status].filter(Boolean).join(', ')}): ${c.reason}`);
  }
  if (r.risk_flags?.length) {
    line();
    line('VERIFICATION FLAGS');
    for (const f of r.risk_flags) line(`- [${f.severity}] ${f.flag}: ${f.detail}${refs(f.source_ids)}`);
  }
  const pr = r.prospecting || {};
  if (pr.talking_points?.length) {
    line();
    line('TALKING POINTS');
    for (const t of pr.talking_points) line(`- ${t}`);
  }
  if (pr.recent_news?.length) {
    line();
    line('RECENT NEWS');
    for (const n of pr.recent_news) line(`- ${n.date ? `${n.date}: ` : ''}${n.headline}${refs(n.source_ids)}`);
  }
  line();
  line(`SOURCE CONFIDENCE: ${r.confidence} — ${r.confidence_rationale}`);
  if (r.notes?.length) {
    line();
    line('NOTES / EXCEPTIONS');
    for (const n of r.notes) line(`- ${n}`);
  }
  line();
  line('SOURCES');
  for (const s of r.sources || []) line(`[${s.id}] ${s.title} — ${s.url}`);
  line();
  line('This report is AI-generated and is provided for research assistance only. Verify all information using the cited sources before relying on it for business, legal, compliance, or credit purposes.');
  return out.join('\n');
}
