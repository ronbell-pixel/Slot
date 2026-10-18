# Option E: NextWin Company Research web app

A branded web app anyone can open from a link. It runs on Claude with live web search and web fetch, checks the Secretary of State registry first, and returns a cited report you can download as a PDF.

- **Stack:** Node 22, Fastify, `@anthropic-ai/sdk`, plain HTML/CSS/JS (no build step), pdfmake for text-based PDFs.
- **Data sources:** official Secretary of State records through **SOS Finder** (when `SOS_API_KEY` is set), plus free public sources reached through Claude's web search: company websites, SEC EDGAR, IRS exempt-organization data, licensing boards, the NPI Registry and news.
- **Sharing:** a public URL protected by access codes. Each person can have their own code (`ACCESS_CODES`), and a usage page at `/admin.html` (opened with `ADMIN_CODE`) shows lookups, SOS Finder credits and estimated Claude cost per person, with a CSV download.

## Run locally

```bash
cd company-research/web-app
npm install
cp .env.example .env              # then add ANTHROPIC_API_KEY
node --env-file=.env server.js    # http://localhost:3000
```

To preview with sample data and no API key:

```bash
MOCK_REPORT_FILE=test/fixtures/sample-report.json npm start
```

Tests: `npm test`

## Deploy on Railway

1. In the existing Railway project (or a new one), choose **+ New → GitHub Repo** and pick this repo.
2. In the service's **Settings**:
   - **Root Directory:** `company-research/web-app`
   - **Branch:** the branch you want to deploy
3. Under **Variables**, add `ANTHROPIC_API_KEY`, `SOS_API_KEY` and `ACCESS_CODE`, and **seal** the two API keys (see `../API-KEYS.md`). The other optional settings are listed in `.env.example`.
4. Under **Settings → Networking**, choose **Generate Domain**, or add a custom domain such as `research.nextwin-os.com` by creating the CNAME record Railway shows you.

The health check is at `/api/health`, and Railway's settings come from `railway.json`. If the new service picks up the slot game's build settings instead, set **Settings → Config-as-code → Railway Config File** to `company-research/web-app/railway.json`.

## How a lookup works

1. The browser posts the search form to `POST /api/research`.
2. The server streams progress back as Server-Sent Events (each search query and page read), so the user sees work happening during the 1–3 minutes a lookup takes.
3. Claude (Haiku 5.5 by default, or Sonnet 5.5 when the person picks **Thorough** in the form; adaptive thinking, effort `medium`) first calls `state_registry_search`, which the server answers from SOS Finder (`src/sosfinder.js`). The key never leaves the server, results are trimmed to the fields the report uses, repeat searches are cached for 24 hours, and each report may use at most 3 registry credits. If the registry has no match, is blocked, or SOS Finder isn't configured, Claude falls back to web search and the report says so. Claude then uses web search and web fetch for everything else, and calls a `submit_company_report` tool whose JSON schema is defined in `src/schema.js`. That structured report drives the on-screen view, the PDF and the copy-as-text output. The same structure is what batch CSV and CRM push will use later.
4. On Sonnet, if Claude's safety filter declines a request, server-side fallback (`fallbacks: "default"`) retries it on another model. Haiku has no server-side fallback.
5. Recent lookups are saved in the user's browser only (localStorage). The server keeps only a usage log (who, when, company name, result, credits and estimated cost) in `DATA_DIR/usage.jsonl`, not the reports themselves.

## Access codes and usage tracking

- **Per-person codes:** set `ACCESS_CODES` to `Name=code` pairs separated by `;`, for example `Ron=nw-8f3k2;Jane Doe=nw-q7x1m`. To add, change or remove someone, edit the variable; Railway redeploys in about a minute. Removing a person's code locks them out immediately and keeps their past usage.
- **Shared code (optional):** `ACCESS_CODE` still works and is tracked as "Team".
- **Usage page:** open `/admin.html` and enter `ADMIN_CODE`. It shows each person's lookups, failures, SOS Finder credits and estimated Claude cost by month, recent lookups, and a CSV download.
- **Monthly cap (optional):** `USER_MONTHLY_LIMIT` limits how many lookups each person can run per month. People see "N of 25 lookups this month" under their name.
- **Storage:** the usage log lives in `DATA_DIR`. On Railway it's a mounted volume (`/data`), so it survives redeploys.

## Cost

**SOS Finder:** a typical report uses 1–2 registry credits, and cached repeats are free. The free plan (50 lookups/month) covers a pilot. To upgrade, change the plan in the SOS Finder dashboard; nothing changes in the app. If you outgrow 3 calls per report, raise `SOS_MAX_CALLS_PER_LOOKUP`. When the monthly quota runs out, the app automatically falls back to web search and marks the report "State registry not verified".

**Anthropic:** you pay Anthropic per lookup: a search fee (about $10 per 1,000 searches, capped at 12 searches per lookup) plus model tokens. Expect roughly **$0.05–$0.15 per Standard (Haiku) lookup** and **$0.25–$0.50 per Thorough (Sonnet) lookup**, depending on how many pages Claude reads. The usage page shows each lookup's depth and estimated cost. Watch actual spend in the Anthropic Console under Usage.

## Files

| Path | Purpose |
|---|---|
| `server.js` | HTTP server, access codes, rate and monthly limits, SSE streaming, usage API |
| `src/access.js` | Per-person access code parsing and matching |
| `src/usage.js` | Usage log (JSONL), per-person summaries, cost estimates |
| `src/research.js` | Claude call loop (web tools, registry tool, pause/resume, report tool) |
| `src/sosfinder.js` | SOS Finder client: trimming, 24-hour cache, error handling |
| `src/prompt.js` | System prompt and per-request message |
| `src/schema.js` | Report JSON schema and validation |
| `public/` | UI (`index.html`, `app.js`, `styles.css`), usage page (`admin.html`, `admin.js`), PDF builder (`pdf.js`), shared field list (`report-fields.js`) |
| `test/` | Unit tests and a fictional sample report |

## Planned next
- **Registry monitors:** a "Watch this company" button using SOS Finder monitors, which alert you when an approved customer's status changes. Re-checks don't use credits.
- **Batch mode:** upload a CSV, run lookups in a queue, download a CSV/ZIP of results.
- **CRM push:** send a report to HubSpot or another CRM as a company record with a note.
- **Shared history:** a server-side report store with user sign-in (in place of per-browser history).
