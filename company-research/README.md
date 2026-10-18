# NextWin AI Company Research

A company research assistant, branded for NextWin AI, that identifies a business and returns a cited profile. It supports two jobs: **gathering the company details needed for credit applications** and **sales prospecting**. It is research assistance only and is not used for credit decisions.

Based on the "Company Research" Microsoft 365 Copilot agent. Changes from that agent:
- Results come back in a structured format, with a citation for every field.
- Officers' contact details are limited to publicly listed **business** contacts, never personal ones.
- New sections: verification flags, prospecting notes and talking points, and other possible matches when the identity is unclear.
- Free public sources only.

## Three ways to use it

| | Option | Who can use it | Setup | Folder |
|---|---|---|---|---|
| **C** | Custom GPT (ChatGPT) | Anyone with the link and a ChatGPT account | ~10 min, no code | [`custom-gpt/`](custom-gpt/SETUP.md) |
| **D** | Claude Project | People in your Claude Team/Enterprise organization | ~10 min, no code | [`claude-project/`](claude-project/SETUP.md) |
| **E** | Web app | Anyone with the URL (plus an optional access code) | Deploy to Railway | [`web-app/`](web-app/README.md) |

Only the web app gives you a consistent branded PDF, live progress, saved lookups, and (later) batch mode and CRM push.

## Brand assets (`brand/`)

Recreated as vector files from the NextWin AI logo:

| File | Use |
|---|---|
| `logo.svg` / `logo.png` | Full logo with tagline, for light backgrounds |
| `logo-light.svg` | Full logo for dark backgrounds |
| `mark.svg` / `mark-light.svg` | Chart mark only (dark and light versions) |
| `icon.svg`, `icon-512.png`, `icon-192.png` | App, GPT and favicon icons |

Colors: ink `#0B0F14` · teal `#12876F` · amber `#DB8B1E` · slate `#667085`. Fonts: Inter (wordmark and UI), JetBrains Mono (tagline).

## Data sources (all free)
Secretary of State and state business registries · company websites · SEC EDGAR · IRS Tax Exempt Organization Search and Form 990 · state licensing boards · NPPES NPI Registry · BBB, directories and news as secondary sources.

Paid APIs such as OpenCorporates are left out for now. The report structure has a place for registry data, so an API can be added later without changing the report.
