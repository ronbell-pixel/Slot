# Where to keep your API keys

Two secrets power the tool:

| Variable | What it is | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Pays for Claude (the research and the writing) | console.anthropic.com → API Keys |
| `SOS_API_KEY` | Pays for state registry lookups | sosfinder.com → Dashboard → API keys |

## The rules
- **Never** paste a key into a chat (including this one), an email, a document, a screenshot or the code.
- **Never** commit a key to GitHub. The `.env` file is for your own computer only; commit `.env.example`, which has blank values.
- Keys live only on the **server**. The web app never sends them to the browser: users' browsers talk to your server, and your server talks to SOS Finder and Anthropic.
- Use a **separate key for each place** (web app, Custom GPT, testing). That way you can revoke one without breaking the others, and SOS Finder's dashboard shows which one is spending credits.
- If a key might have leaked, **revoke it** in the provider's dashboard, create a new one and update the variable. Rotating once or twice a year is good practice anyway.

## 1. Web app on Railway (production)
1. Open your Railway project → the **company-research** service → **Variables**.
2. Click **New Variable** and add `SOS_API_KEY`, then `ANTHROPIC_API_KEY`, each with its value.
3. On each key, open the **⋮** menu and choose **Seal**. A sealed value is given to the app but can never be viewed again in the Railway dashboard, API or logs, even by you. To change it later, replace it.
4. Railway redeploys the service automatically. The sidebar then shows "State registry data connected (SOS Finder)".

Only people you invite to the Railway project can manage variables, so keep that list short and turn on two-factor login for your Railway, SOS Finder and Anthropic accounts.

## 2. Custom GPT
Put the SOS Finder key in the GPT's **Action → Authentication → API Key** box (Custom header `x-api-key`), as described in `custom-gpt/SETUP.md`. OpenAI stores it encrypted, and GPT users can't see it. Create a separate SOS Finder key named "Custom GPT" for this.

## 3. Testing in a Claude Code cloud session (optional)
For me to run real lookups while building:
1. In the Claude app, open the session's **cloud environment** menu in the title bar → **Edit**.
2. Add the keys under **Network secrets** (called **API credentials** in older versions of the app). If that section isn't there, add them as environment variables named `SOS_API_KEY` and `ANTHROPIC_API_KEY`.
3. Start a new session; it picks them up. Use separate "testing" keys you can revoke afterwards.

## 4. Claude Code or Claude Desktop on your own computer (optional)
To use SOS Finder directly from Claude, set the key in your shell profile (not in a file inside the repo), then add the MCP server:

```bash
export SOS_API_KEY=...        # in ~/.zshrc or ~/.bashrc
claude mcp add sosfinder https://api.sosfinder.com/mcp --transport http \
  --header "Authorization: Bearer $SOS_API_KEY"
```

## Starting on the free plan
SOS Finder's free plan gives 50 lookups a month. The web app uses at most 3 per report (usually 1–2), and cached repeat searches are free. When the month's quota runs out, reports still work: they fall back to web search and say "State registry not verified". To upgrade, change the plan in the SOS Finder dashboard. The key stays the same, so nothing changes in Railway or the code.
