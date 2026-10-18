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
5. **Instructions:** paste the whole of `instructions.md` (about 5,000 characters; the limit is 8,000).
6. **Conversation starters:** add these four.
   - `Research a company: [name], [state]`
   - `Verify this credit applicant: [legal name], [city, state], [address]`
   - `Prospecting brief for [company] in [city, state]`
   - `Check professional licenses for [business or person], [state]`
7. **Knowledge:** leave empty.
8. **Capabilities:** turn on **Web Search** and **Code Interpreter & Data Analysis** (Code Interpreter makes the PDFs). Turn **Image Generation** off.
9. **Actions:** none for now. They can be added later for free APIs such as SEC EDGAR or the NPI Registry.
10. Under **Additional settings**, turn off "Use conversation data to improve models" if your plan has that option.
11. Click **Create** and choose who can use it:
    - **Only me**, while you test it.
    - **Anyone with the link**, to share with clients and partners.
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
