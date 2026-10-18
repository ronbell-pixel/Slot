# Option C: NextWin Company Research as a Custom GPT (ChatGPT)

About 10 minutes to set up. Anyone with the link and a ChatGPT account can use it.

## What you need
- A ChatGPT Plus, Team or Enterprise account. Building a GPT requires a paid plan; on the free plan you can only use GPTs.
- The files in this folder and `../brand/`.

## Steps
1. Go to **chatgpt.com → Explore GPTs → + Create**, then open the **Configure** tab.
2. **Profile picture:** upload `../brand/icon-512.png`.
3. **Name:** `NextWin Company Research`
4. **Description:** `Source-grounded company profiles for credit applications and sales prospecting. Checks Secretary of State records first, with cited sources.`
5. **Instructions:** paste the whole of `instructions.md` (about 5,600 characters; the limit is 8,000).
6. **Conversation starters:** add these four.
   - `Research a company: [name], [state]`
   - `Verify this credit applicant: [legal name], [city, state], [address]`
   - `Prospecting brief for [company] in [city, state]`
   - `Check professional licenses for [business or person], [state]`
7. **Knowledge:** leave empty.
8. **Capabilities:** turn on **Web Search** and **Code Interpreter & Data Analysis** (Code Interpreter makes the PDFs). Turn **Image Generation** off.
9. **Actions: connect SOS Finder** (state registry data)
   1. Click **Create new action**.
   2. **Authentication** → **API Key** → paste your SOS Finder key → **Auth Type: Custom** → **Custom Header Name:** `x-api-key` → **Save**. OpenAI stores the key encrypted; it never appears in the instructions or to users.
   3. **Schema:** paste the whole of `sosfinder-action.yaml`.
   4. **Privacy policy:** the privacy policy link from the footer of sosfinder.com, or your own privacy page.
   5. Use **Test** next to `searchStateRegistry` to confirm it returns a record.
10. Under **Additional settings**, turn off "Use conversation data to improve models" if your plan has that option.
11. Click **Create** and choose who can use it. **Every lookup made through the GPT uses your SOS Finder credits**, and a GPT can't limit usage per person, so keep it to **Only me** or **Your workspace** while you're on a small plan. Avoid "Anyone with the link" and the GPT Store until you've moved to a plan with enough credits.
    - **Only me**, while you test it.
    - **Anyone with the link**: only once your SOS Finder plan has room for outside usage.
    - **Your workspace** (Team/Enterprise only), for internal staff.
    - **GPT Store**, if you want it listed publicly. This requires a verified builder profile with nextwin-os.com as your domain.

## Test before sharing
Run three lookups and check each against the state registry yourself:
- a well-known public company (SEC data should appear)
- a small local LLC (registry data should appear and the confidence should be honest)
- a nonprofit (IRS data, and an EIN if one is public)

## Limits to know
- Browsing quality varies. Some state registries block automated access or need CAPTCHAs, so the GPT may cite secondary sources and mark confidence **Medium**. That's expected.
- The PDF comes from Code Interpreter, so its layout varies between chats. Use the web app (Option E) for a consistent, branded PDF.
- Batch lookups and CRM push aren't available in a GPT. They're planned for the web app.
