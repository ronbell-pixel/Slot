// Builds a branded, text-based (searchable) PDF of a report with pdfmake, loaded from /vendor/pdfmake.
import { IDENTIFICATION_FIELDS, PROFILE_FIELDS } from './report-fields.js';
import { matchLabel, formatDate } from './report-format.js';

const INK = '#0B0F14';
const TEAL = '#12876F';
const AMBER = '#DB8B1E';
const SLATE = '#667085';
const LINE = '#E4E7EC';
const RED = '#C2412D';

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="495 105 400 400">
<polyline points="558,432 657,243 723,326 833,178" fill="none" stroke="${INK}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="558" cy="432" r="31" fill="${INK}"/><circle cx="723" cy="326" r="26" fill="${TEAL}"/>
<circle cx="833" cy="178" r="23" fill="${INK}" stroke="${AMBER}" stroke-width="13"/></svg>`;

const cite = (ids) => (ids?.length ? { text: ` [${ids.join(', ')}]`, color: TEAL, fontSize: 7 } : '');
const dash = (v) => v || '—';

function factsTable(section, defs) {
  return {
    table: {
      widths: [150, '*'],
      body: defs.map(([key, label]) => {
        const f = section?.[key];
        return [
          { text: label, color: SLATE, bold: true, fontSize: 8.5 },
          f?.value ? { text: [f.value, cite(f.source_ids)] } : { text: 'Not found', color: SLATE, italics: true },
        ];
      }),
    },
    layout: rowLines,
  };
}

const rowLines = {
  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.5),
  vLineWidth: () => 0,
  hLineColor: () => LINE,
  paddingTop: () => 4,
  paddingBottom: () => 4,
  paddingLeft: () => 0,
};

function dataTable(headers, rows, widths) {
  return {
    table: {
      headerRows: 1,
      widths: widths || headers.map(() => '*'),
      body: [headers.map((h) => ({ text: h, bold: true, color: SLATE, fontSize: 8 })), ...rows],
    },
    layout: rowLines,
  };
}

const heading = (text) => ({ text: text.toUpperCase(), style: 'h3' });

export function buildDocDefinition({ report: r, meta, input }) {
  const id = r.identification || {};
  const name = id.legal_name?.value || input?.company || 'Company';
  const checked = formatDate(meta?.checked_at);
  const pr = r.prospecting || {};
  const content = [];

  content.push(
    { text: name, style: 'h1' },
    { text: `${r.input_summary || ''}  ·  Checked ${checked}`, color: SLATE, fontSize: 9, margin: [0, 2, 0, 8] },
    {
      columns: [
        { text: [{ text: 'Source confidence: ', color: SLATE }, { text: r.confidence, bold: true, color: { High: TEAL, Medium: AMBER, Low: RED }[r.confidence] || INK }] },
        { text: [{ text: 'Match: ', color: SLATE }, { text: matchLabel(r.match_status), bold: true }] },
        { text: [{ text: 'Status: ', color: SLATE }, { text: dash(id.entity_status?.value), bold: true }] },
      ],
      fontSize: 9.5,
      margin: [0, 0, 0, 10],
    },
    {
      table: { widths: ['*'], body: [[{ text: [{ text: 'AI-generated research. ', bold: true }, 'Provided for research assistance only; not a consumer report. Verify all information using the cited sources before relying on it for business, legal, compliance, or credit purposes.'], fontSize: 8, fillColor: '#FCF1E1', margin: [6, 5, 6, 5] }]] },
      layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => AMBER },
      margin: [0, 0, 0, 12],
    },
    heading('Business summary'),
    { text: r.business_summary || '', margin: [0, 0, 0, 12] },
    heading('Company identification'),
    factsTable(id, IDENTIFICATION_FIELDS),
  );

  if (r.risk_flags?.length) {
    content.push(heading('Verification flags'), {
      ul: r.risk_flags.map((f) => ({
        text: [{ text: `${f.flag}`, bold: true, color: f.severity === 'warning' ? RED : f.severity === 'caution' ? AMBER : INK }, ` — ${f.detail}`, cite(f.source_ids)],
        margin: [0, 0, 0, 3],
      })),
    });
  }

  content.push(heading('Secretary of State findings'), { text: r.registry_findings || '' });
  if (r.candidates?.length) {
    content.push(heading('Other possible matches'), dataTable(['Name', 'State', 'Status', 'Why'],
      r.candidates.map((c) => [c.name, dash(c.state), dash(c.status), c.reason]), ['*', 40, 60, '*']));
  }

  content.push(heading('Company profile'), factsTable(r.profile, PROFILE_FIELDS));

  if (r.people?.length) {
    content.push(heading('Officers & key people'), dataTable(['Name', 'Title', 'Business contact'],
      r.people.map((p) => [{ text: [p.name, cite(p.source_ids)] }, dash(p.title), dash(p.business_contact)])));
  }

  content.push(heading('Professional licenses'), r.licenses?.length
    ? dataTable(['License', 'Issuer', 'Number', 'Status', 'Expires'],
      r.licenses.map((l) => [{ text: [l.type, cite(l.source_ids)] }, dash(l.issuer), dash(l.number), dash(l.status), dash(l.expiration)]),
      ['*', '*', 70, 55, 55])
    : { text: 'No professional licenses found in public sources.', color: SLATE, italics: true });

  if (pr.talking_points?.length) content.push(heading('Talking points'), { ul: pr.talking_points });
  if (pr.recent_news?.length) {
    content.push(heading('Recent news'), {
      ul: pr.recent_news.map((n) => ({ text: [n.date ? { text: `${n.date}: `, bold: true } : '', n.headline, cite(n.source_ids)] })),
    });
  }
  if (pr.social_profiles?.length) {
    content.push(heading('Online profiles'), { ul: pr.social_profiles.map((s) => ({ text: `${s.network}: ${s.url}`, link: s.url, color: TEAL })) });
  }

  content.push(heading(`Source confidence: ${r.confidence}`), { text: r.confidence_rationale || '' });
  if (r.notes?.length) content.push(heading('Notes & exceptions'), { ul: r.notes });

  content.push(heading('Sources'), {
    stack: (r.sources || []).map((s) => ({
      text: [{ text: `[${s.id}] `, bold: true }, { text: s.title || s.url }, { text: `\n${s.url}`, color: TEAL, link: s.url, fontSize: 7.5 }],
      margin: [0, 0, 0, 4],
    })),
  });

  return {
    pageSize: 'LETTER',
    pageMargins: [48, 72, 48, 54],
    info: { title: `${name} — Company Research`, author: 'NextWin AI', creator: 'NextWin AI Company Research' },
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: INK, lineHeight: 1.25 },
    styles: {
      h1: { fontSize: 20, bold: true },
      h3: { fontSize: 8.5, bold: true, color: SLATE, characterSpacing: 0.8, margin: [0, 12, 0, 5] },
    },
    header: () => ({
      margin: [48, 26, 48, 0],
      columns: [
        { svg: MARK_SVG, width: 22, height: 22 },
        { text: [{ text: 'NextWin', bold: true, fontSize: 13 }, { text: ' AI', color: SLATE, fontSize: 13 }], margin: [6, 3, 0, 0], width: 'auto' },
        { text: 'COMPANY RESEARCH REPORT', alignment: 'right', fontSize: 7.5, color: TEAL, characterSpacing: 1.5, margin: [0, 7, 0, 0] },
      ],
    }),
    footer: (page, pages) => ({
      margin: [48, 16, 48, 0],
      columns: [
        { text: `Work flows. Business grows.  ·  nextwin-os.com  ·  Checked ${checked}`, fontSize: 7.5, color: SLATE },
        { text: `Page ${page} of ${pages}`, alignment: 'right', fontSize: 7.5, color: SLATE },
      ],
    }),
    content,
  };
}

export function pdfFilename({ report, input }) {
  const name = report?.identification?.legal_name?.value || input?.company || 'company';
  const slug = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'company';
  return `NextWin-Research-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

export async function downloadPdf(entry) {
  if (!window.pdfMake) throw new Error('pdfmake not loaded');
  await window.pdfMake.createPdf(buildDocDefinition(entry)).download(pdfFilename(entry));
}
