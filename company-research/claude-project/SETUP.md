# Option D: NextWin Company Research as a Claude Project

## Why a Claude Project and not a Claude artifact
A shared Claude artifact page can ask Claude questions, but in that mode Claude **cannot browse the web**. It would answer from memory, which is exactly what this tool must never do. A **Claude Project** with web search turned on keeps the same Claude-native, shareable experience and does real, cited registry research. (The web app in Option E also runs on Claude with live web search.)

## What you need
- To share with your team: a **Claude Team or Enterprise** plan. Projects are shared with people in your organization.
- A Pro plan works for your own use only.

## Steps
1. At **claude.ai → Projects → Create project**, name it `NextWin Company Research`. Description: `Source-grounded company profiles for credit applications and sales prospecting.`
2. Open **Set project instructions** and paste the whole of `project-instructions.md`.
3. **Project knowledge** (optional): upload `../brand/logo.png` so Claude can put the logo in generated PDFs. You can also add your own checklist, for example a credit-application intake form, so reports follow your field order.
4. Under **Settings → Capabilities** (or the tools menu in chat), turn on:
   - **Web search**: required
   - **Code execution and file creation**: for PDF downloads
   - **Artifacts**: optional, for print-ready reports
5. **Share:** use the project's **Share** button and add teammates or your whole organization. Give **Can use** to people running lookups and **Can edit** to anyone maintaining the instructions.

## How people use it
Open the project, start a chat, and type for example `Research Acme Widgets LLC, Austin TX — credit application`. Claude searches the Secretary of State registry and other sources, returns the cited report, and offers a PDF.

## Limits to know
- Only people in your Claude organization can use the project. For clients or partners outside it, share the web app (Option E) or the Custom GPT (Option C).
- Some state registries block automated access. When that happens, Claude cites secondary sources and lowers the confidence rating.
