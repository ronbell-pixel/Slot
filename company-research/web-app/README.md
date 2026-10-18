# Option E: NextWin Company Research web app

A branded web app anyone can open from a link. It runs on Claude with live web search and web fetch, checks the Secretary of State registry first, and returns a cited report you can download as a PDF.

- **Stack:** Node 22, Fastify, `@anthropic-ai/sdk`, plain HTML/CSS/JS (no build step), pdfmake for text-based PDFs.
- **Data sources:** free public sources only. That means state registries, company websites, SEC EDGAR, IRS exempt-organization data, licensing boards, the NPI Registry and news, all reached through Claude's web search. No paid data APIs.
- **Sharing:** a public URL, optionally protected by a team access code (`ACCESS_CODE`).

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
3. Under **Variables**, add `ANTHROPIC_API_KEY` and `ACCESS_CODE`. The other optional settings are listed in `.env.example`.
4. Under **Settings → Networking**, choose **Generate Domain**, or add a custom domain such as `research.nextwin-os.com` by creating the CNAME record Railway shows you.

The health check is at `/api/health`, and Railway's settings come from `railway.json`. If the new service picks up the slot game's build settings instead, set **Settings → Config-as-code → Railway Config File** to `company-research/web-app/railway.json`.

## How a lookup works

1. The browser posts the search form to `POST /api/research`.
2. The server streams progress back as Server-Sent Events (each search query and page read), so the user sees work happening during the 1–3 minutes a lookup takes.
3. Claude (`claude-opus-5-5`, adaptive thinking, effort `medium`) uses web search and web fetch, then calls a `submit_company_report` tool whose JSON schema is defined in `src/schema.js`. That structured report drives the on-screen view, the PDF and the copy-as-text output. The same structure is what batch CSV and CRM push will use later.
4. If Claude's safety filter declines a request, server-side fallback (`fallbacks: "default"`) retries it on another model.
5. Recent lookups are saved in the user's browser only (localStorage). Nothing is stored on the server.

## Cost

You pay Anthropic per lookup: a search fee (about $10 per 1,000 searches, capped at 12 searches per lookup) plus model tokens. **Expect roughly $0.30–$1.00 per lookup**, depending on how many pages Claude reads. To lower it, set `CLAUDE_EFFORT=low` or reduce `MAX_WEB_FETCHES`. To raise thoroughness, set `CLAUDE_EFFORT=high`. Watch actual spend in the Anthropic Console under Usage.

## Files

| Path | Purpose |
|---|---|
| `server.js` | HTTP server, access code check, rate limit, SSE streaming |
| `src/research.js` | Claude call loop (web tools, pause/resume, report tool) |
| `src/prompt.js` | System prompt and per-request message |
| `src/schema.js` | Report JSON schema and validation |
| `public/` | UI (`index.html`, `app.js`, `styles.css`), PDF builder (`pdf.js`), shared field list (`report-fields.js`) |
| `test/` | Unit tests and a fictional sample report |

## Planned next
- **Batch mode:** upload a CSV, run lookups in a queue, download a CSV/ZIP of results.
- **CRM push:** send a report to HubSpot or another CRM as a company record with a note.
- **Shared history:** a server-side report store with user sign-in (in place of per-browser history).
