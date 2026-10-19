const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, BorderStyle, Header, Footer, PageNumber, HeadingLevel, PageBreak, TabStopType,
  VerticalAlign, HeightRule, ImageRun,
} = require('docx');
const path = require('path');
const BRAND = path.join(__dirname, 'brand');
const img = (f, w, h) => new ImageRun({ type: 'png', data: fs.readFileSync(path.join(BRAND, f)), transformation: { width: w, height: h } });

// NextWin AI brand: ink, teal, orange spark, slate
const ACCENT = '028071', DARK = '0A1017', MUTED = '646B7A', SOFT = 'E6F2F0', SPARK = 'E28820', LINE = 'E3E6EA', FONT = 'Arial';
const W = 9360;
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const hair = { style: BorderStyle.SINGLE, size: 4, color: LINE };

const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
const p = (runs, o = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [runs], ...o });

function sectionHead(num, title, intro) {
  return [
    p([t(num, { color: SPARK, bold: true, size: 22 }), t('   ' + title.toUpperCase(), { color: DARK, bold: true, size: 22, characterSpacing: 40 })], {
      heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 360, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: DARK, space: 6 } },
    }),
    p(t(intro, { color: MUTED, size: 19, italics: true }), { spacing: { after: 160 }, keepNext: true }),
  ];
}

function cell(children, width, o = {}) {
  return new TableCell({
    children, width: { size: width, type: WidthType.DXA },
    margins: { top: 110, bottom: 110, left: 140, right: 140 },
    borders: { top: hair, bottom: hair, left: none, right: none },
    verticalAlign: VerticalAlign.TOP, ...o,
  });
}

// rows: [question, hint?, options?]
function qaTable(rows) {
  const cw = [3600, 5760];
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: cw,
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: hair, insideVertical: none },
    rows: rows.map(([q, hint, opts]) => {
      const left = [p(t(q, { bold: true, size: 20, color: DARK }))];
      if (hint) left.push(p(t(hint, { size: 17, color: MUTED }), { spacing: { before: 40 } }));
      const right = opts
        ? [p(opts.map((o, i) => t((i ? '    ' : '') + '☐\u00A0' + o.replace(/ /g, '\u00A0'), { size: 19, color: DARK })), { spacing: { line: 320 } })]
        : [p(t(''))];
      return new TableRow({
        cantSplit: true,
        height: { value: opts ? 500 : 720, rule: HeightRule.ATLEAST },
        children: [cell(left, cw[0], { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F9FAFB' } }), cell(right, cw[1])],
      });
    }),
  });
}

function gridTable(headers, widths, rows, blankRows = 0) {
  const head = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell([p(t(h, { bold: true, color: 'FFFFFF', size: 18 }))], widths[i], {
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: DARK }, borders: { top: none, bottom: none, left: none, right: none },
    })),
  });
  const body = [...rows, ...Array(blankRows).fill(null)].map((r, ri) => new TableRow({
    cantSplit: true, height: { value: 460, rule: HeightRule.ATLEAST },
    children: widths.map((w, i) => cell([p(t(r ? (r[i] || '') : '', { size: 18, bold: i === 0, color: i === 0 ? DARK : MUTED }))], w,
      ri % 2 ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F9FAFB' } } : {})),
  }));
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, rows: [head, ...body] });
}

function callout(title, text) {
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: SOFT },
      margins: { top: 180, bottom: 180, left: 240, right: 240 },
      borders: { top: none, bottom: none, right: none, left: { style: BorderStyle.SINGLE, size: 24, color: ACCENT } },
      children: [p(t(title, { bold: true, color: ACCENT, size: 20 }), { spacing: { after: 60 } }), p(t(text, { size: 19, color: DARK }))],
    })] })],
  });
}
const gap = (n = 160) => p(t(''), { spacing: { after: n } });

// ---------- Content ----------
const YN = ['Yes', 'No', 'Not sure'];
const sections = [
  ['01', 'Contact & Business Basics', 'Who you are and how we reach you.', [
    ['Business legal name', 'And any "doing business as" name'],
    ['Primary contact', 'Name, role, email, mobile'],
    ['Who approves decisions?', 'Name of the final sign-off person, if different'],
    ['Business address & service area', 'Physical location, and the cities/regions you serve'],
    ['Hours of operation'],
    ['Business phone & public email', 'What should appear on the website'],
    ['Industry / business type'],
    ['In one or two sentences, what do you do?', 'Your elevator pitch'],
    ['Years in business & team size'],
    ['Preferred way to communicate', null, ['Email', 'Phone', 'Text', 'Video call']],
  ]],
  ['02', 'Brand & Identity', 'How your business should look, sound and feel.', [
    ['Do you have a logo?', 'Please send vector files (SVG, AI, EPS) or high-res PNG', ['Yes', 'No', 'Needs refresh']],
    ['Brand colors', 'Hex codes if known, or describe them'],
    ['Brand fonts', 'If you have them'],
    ['Brand guidelines / style guide?', null, YN],
    ['Three words that describe your brand', 'e.g. friendly, premium, local'],
    ['Tone of voice', null, ['Professional', 'Friendly', 'Playful', 'Luxury', 'Technical']],
    ['What makes you different from competitors?', 'Your unique selling points'],
    ['Websites you love (and why)', 'List 2–3 links, any industry'],
    ['Websites you dislike (and why)'],
  ]],
  ['03', 'Goals & Audience', 'What the website needs to achieve, and for whom.', [
    ['Main goal of the website', null, ['Generate leads', 'Sell online', 'Book appointments', 'Inform', 'Build credibility']],
    ['What is the #1 action a visitor should take?', 'Call, book, buy, fill in a form…'],
    ['Who is your ideal customer?', 'Age, location, job, needs, budget'],
    ['What problems do you solve for them?'],
    ['Top 3 competitors', 'Names and websites'],
    ['How will you measure success?', 'e.g. 20 leads/month, online sales, fewer phone calls'],
    ['Current website (if any)', 'URL, what you like and what isn\'t working'],
  ]],
  ['04', 'Website Structure & Content', 'The pages, words and images that make up your site.', [
    ['Pages needed', null, ['Home', 'About', 'Services', 'Pricing', 'Portfolio', 'Testimonials', 'FAQ', 'Blog', 'Contact', 'Careers']],
    ['Other pages not listed above'],
    ['List of services / products', 'Name, short description and price (if shown)'],
    ['Who will write the copy?', null, ['We will', 'You will', 'Together']],
    ['Photos & video', null, ['Have my own', 'Need stock', 'Need a photographer']],
    ['Testimonials / reviews to feature', 'Paste quotes or link to Google/Yelp profile'],
    ['Certifications, awards, partners or logos to show'],
    ['Legal pages needed', null, ['Privacy policy', 'Terms', 'Cookie notice', 'Accessibility statement']],
  ]],
  ['05', 'Features & Functionality', 'What the website needs to do.', [
    ['Contact / quote request forms', 'What fields? Where should submissions go?', YN],
    ['Online booking / scheduling', null, YN],
    ['E-commerce / online payments', 'Approx. number of products, shipping, taxes', YN],
    ['Member login / client portal', null, YN],
    ['Blog or news section', 'Who will post, and how often?', YN],
    ['Email newsletter sign-up', null, YN],
    ['Live chat or AI assistant', 'See Section 08', YN],
    ['Multiple languages', 'Which ones?', YN],
    ['Maps, galleries, video, social feeds'],
    ['Anything else it must do?'],
  ]],
  ['06', 'Domain, Hosting & Technical', 'Access and accounts we\'ll need to launch.', [
    ['Do you own a domain name?', 'Which one, and where is it registered (GoDaddy, Namecheap…)?', ['Yes', 'No', 'Need help']],
    ['Current hosting provider'],
    ['Business email provider', null, ['Google Workspace', 'Microsoft 365', 'Other', 'None']],
    ['Who manages the site after launch?', null, ['You (we train)', 'Us (care plan)', 'Shared']],
    ['Login access we\'ll need', 'Please share securely (password manager) — never in this document'],
    ['Accessibility or compliance requirements', 'ADA/WCAG, HIPAA, GDPR, industry rules'],
  ]],
  ['07', 'SEO & Marketing', 'Getting found and growing traffic.', [
    ['Keywords customers search to find you', 'e.g. "plumber in Austin"'],
    ['Google Business Profile', null, ['Have one', 'Need one', 'Not sure']],
    ['Analytics in place?', null, ['Google Analytics', 'Search Console', 'Meta Pixel', 'None']],
    ['Social media accounts', 'List links: Facebook, Instagram, LinkedIn, TikTok, YouTube, X'],
    ['Paid advertising', 'Google Ads, Meta Ads — current or planned?'],
    ['Ongoing content help wanted?', null, ['Blog posts', 'Social posts', 'Email campaigns', 'No']],
  ]],
];

const aiRows = [
  ['What should the AI assistant do?', null, ['Answer FAQs', 'Capture leads', 'Book appointments', 'Quote estimates', 'Customer support', 'Internal helper for staff']],
  ['Where should it live?', null, ['Website chat', 'Phone / voice', 'SMS', 'Facebook / Instagram DM', 'Email', 'WhatsApp']],
  ['Assistant name & personality', 'e.g. "Sam" — warm, concise, professional'],
  ['Top 10–20 questions customers ask you', 'Attach a list with your ideal answers if possible'],
  ['Information it may share', 'Pricing, hours, service areas, policies, availability'],
  ['Information it must NEVER share or promise', 'Discounts, guarantees, medical/legal advice, internal details'],
  ['When should it hand off to a human?', 'Triggers: angry customer, large job, specific keywords'],
  ['Who receives handoffs and leads?', 'Name, email/phone, and response time you commit to'],
  ['Lead details to collect', null, ['Name', 'Email', 'Phone', 'Address', 'Budget', 'Timeline', 'Service needed']],
  ['Hours the assistant is active', null, ['24/7', 'After hours only', 'Business hours only']],
  ['Languages it should speak'],
  ['Source documents to train it on', 'Service menus, price lists, FAQs, policies, brochures, past emails'],
  ['Booking rules', 'Calendar to use, buffer times, job types, minimum notice'],
  ['Compliance or privacy concerns', 'Recording consent, data retention, industry regulations'],
  ['How will we judge it\'s working?', 'e.g. % questions answered, leads booked, time saved'],
];

const tools = [
  ['CRM / customer database', 'HubSpot, Salesforce, Zoho, GoHighLevel, Pipedrive'],
  ['Invoicing & billing', 'QuickBooks, FreshBooks, Wave, Xero, Square'],
  ['Payments', 'Stripe, Square, PayPal, Clover'],
  ['Accounting / bookkeeping', 'QuickBooks, Xero'],
  ['Prospecting / lead generation', 'Apollo, LinkedIn Sales Navigator, ZoomInfo, Seamless'],
  ['Scheduling / booking', 'Calendly, Acuity, Google Calendar, Jobber'],
  ['Email marketing', 'Mailchimp, Klaviyo, Constant Contact, ActiveCampaign'],
  ['Field service / job management', 'Jobber, ServiceTitan, Housecall Pro'],
  ['Project management', 'Asana, Trello, Monday, ClickUp'],
  ['Phone system / texting', 'RingCentral, Google Voice, OpenPhone, Twilio'],
  ['Reviews & reputation', 'Google, Yelp, Birdeye, Podium'],
  ['Social media scheduling', 'Buffer, Hootsuite, Later'],
  ['E-commerce platform', 'Shopify, WooCommerce, Square Online'],
  ['Forms & e-signatures', 'Jotform, Typeform, DocuSign'],
  ['Team chat / documents', 'Slack, Teams, Google Drive, Dropbox'],
];

const assets = [
  'Logo files (vector + PNG)', 'Brand guide, colors, fonts', 'Photos & videos', 'Copy for each page (or notes)',
  'Service / product list with pricing', 'Testimonials & reviews', 'FAQ list with answers', 'Domain & hosting access (via password manager)',
  'Tool logins / admin invites (CRM, calendar, etc.)', 'Social media links', 'Legal pages (if you have them)',
];

// ---------- Build ----------
const children = [];

// Cover
children.push(
  gap(240),
  p(img('nextwin-logo.png', 400, 78), { spacing: { after: 1200 } }),
  p(t('CLIENT ONBOARDING', { color: ACCENT, bold: true, size: 20, characterSpacing: 120 }), { spacing: { after: 120 } }),
  p(t('Website & AI Assistant', { bold: true, size: 60, color: DARK })),
  p(t('Discovery Questionnaire', { size: 60, color: ACCENT }), { spacing: { after: 360 } }),
  p(t('Everything we need to design, build and launch your new website — plus set up an AI assistant that works with the tools you already use.', { size: 24, color: MUTED }), { spacing: { after: 720 } }),
);
const metaW = [2800, 6560];
children.push(new Table({
  width: { size: W, type: WidthType.DXA }, columnWidths: metaW,
  rows: ['Client / Business', 'Prepared for', 'Date sent', 'Date returned', 'Project #'].map(l => new TableRow({
    height: { value: 520, rule: HeightRule.ATLEAST },
    children: [cell([p(t(l.toUpperCase(), { size: 16, bold: true, color: MUTED, characterSpacing: 40 }))], metaW[0], { verticalAlign: VerticalAlign.CENTER }),
      cell([p(t(''))], metaW[1])],
  })),
}));
children.push(gap(480), callout('How to fill this in',
  'Answer what you can — short notes are fine and "not sure" is a perfectly good answer. Tick boxes by replacing ☐ with ☒ (or just highlight). Skip anything that doesn\'t apply. Please never type passwords into this document; we\'ll share a secure link for logins.'));
children.push(p(new PageBreak()));

for (const [num, title, intro, rows] of sections) {
  children.push(...sectionHead(num, title, intro), qaTable(rows), gap());
}

children.push(...sectionHead('08', 'AI Assistant Setup', 'Helps us configure an assistant that sounds like you, knows your business and knows when to bring in a human.'));
children.push(qaTable(aiRows), gap());

children.push(...sectionHead('09', 'Tools & Programs You Use', 'Tell us what runs your business today so the website and AI assistant can connect to it — leads straight into your CRM, bookings onto your calendar, invoices into your billing system.'));
children.push(gridTable(['Category', 'Examples', 'What you use', 'Happy with it?', 'Connect?'],
  [2200, 2560, 2200, 1200, 1200], tools.map(([c, e]) => [c, e]), 2));
children.push(gap(120), qaTable([
  ['Where do new leads come from today?', 'Referrals, Google, social, ads, walk-ins, cold outreach'],
  ['What happens to a lead after it comes in?', 'Walk us through your current process step by step'],
  ['Which tasks eat up the most time each week?', 'These are prime candidates for automation'],
  ['Any tools you\'re thinking of switching to or away from?'],
  ['Who has admin access to these tools?', 'We\'ll request invites — not passwords'],
]), gap());

children.push(...sectionHead('10', 'Budget, Timeline & Approvals', 'So we can plan the right scope and schedule.'));
children.push(qaTable([
  ['Budget range', null, ['Under $2.5k', '$2.5–5k', '$5–10k', '$10k+']],
  ['Ongoing monthly budget', 'Hosting, care plan, AI assistant, marketing'],
  ['Ideal launch date', 'Is it tied to an event, season or campaign?'],
  ['Hard deadline?', null, YN],
  ['Review style', null, ['Weekly check-ins', 'Milestone reviews', 'As needed']],
  ['Anything else we should know?', 'Concerns, past bad experiences, must-haves'],
]), gap());

children.push(...sectionHead('11', 'Asset Checklist', 'Please gather and send the following (a shared folder works great).'));
const half = Math.ceil(assets.length / 2);
children.push(new Table({
  width: { size: W, type: WidthType.DXA }, columnWidths: [4680, 4680],
  borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
  rows: Array.from({ length: half }, (_, i) => new TableRow({
    children: [assets[i], assets[i + half]].map(a => new TableCell({
      width: { size: 4680, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 80, right: 80 },
      borders: { top: none, bottom: none, left: none, right: none },
      children: [p(a ? [t('☐  ', { color: ACCENT, size: 22 }), t(a, { size: 20 })] : [t('')])],
    })),
  })),
}));

children.push(gap(360), callout('Next steps',
  'Once we receive this questionnaire we\'ll schedule a 30–45 minute kickoff call, then send a proposal with sitemap, timeline and AI assistant plan within 3 business days.'));
children.push(gap(480));
const sigW = [4500, 360, 4500];
children.push(new Table({
  width: { size: W, type: WidthType.DXA }, columnWidths: sigW,
  borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
  rows: [new TableRow({ height: { value: 700, rule: HeightRule.ATLEAST }, children: sigW.map((w, i) => new TableCell({
    width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM,
    borders: { top: none, left: none, right: none, bottom: i === 1 ? none : { style: BorderStyle.SINGLE, size: 6, color: DARK } },
    children: [p(t(''))] })) }),
  new TableRow({ children: sigW.map((w, i) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: { top: none, bottom: none, left: none, right: none },
    children: [p(t(['Client signature', '', 'Date'][i], { size: 16, color: MUTED }))] })) })],
}));

const doc = new Document({
  creator: 'NextWin AI', title: 'NextWin AI — Website & AI Assistant Discovery Questionnaire',
  styles: { default: { document: { run: { font: FONT, size: 20, color: DARK } } } },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1260, bottom: 1080, left: 1440, right: 1440 } }, titlePage: true },
    headers: { default: new Header({ children: [p([img('nextwin-mark.png', 18, 16), t('  NextWin ', { size: 17, bold: true, color: DARK }), t('AI', { size: 17, bold: true, color: MUTED }), t('   ·   Discovery Questionnaire', { size: 16, color: MUTED }), t('\tClient: ________________________', { size: 16, color: MUTED })],
      { tabStops: [{ type: TabStopType.RIGHT, position: W }] })] }), first: new Header({ children: [p(t(''))] }) },
    footers: { default: new Footer({ children: [p([t('WORK FLOWS. BUSINESS GROWS.', { size: 15, color: ACCENT, bold: true, characterSpacing: 40 }), t('   ·   Confidential', { size: 16, color: MUTED }), new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: MUTED, font: FONT })],
      { tabStops: [{ type: TabStopType.RIGHT, position: W }] })] }), first: new Footer({ children: [p(t(''))] }) },
    children,
  }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(process.argv[2], b); console.log('ok'); });
