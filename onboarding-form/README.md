# NextWin AI client onboarding form

A single-page, multi-step version of `docs/Client-Website-AI-Onboarding-Questionnaire.docx`.
Each submission is saved as JSON in `DATA_DIR` and emailed via [Resend](https://resend.com).
The last step takes extra notes and file attachments (limits in `UPLOAD` in `public/questions.js`);
files are stored under `DATA_DIR/files/<id>/`, attached to the email, and downloadable from `/admin`.
There are no npm dependencies, so `npm start` runs it on Node 22.

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key (email is skipped if unset) |
| `NOTIFY_EMAIL` | Where submissions are sent (comma-separate for several) |
| `FROM_EMAIL` | Sender, e.g. `NextWin AI Onboarding <onboard@nextwin-os.com>` (domain must be verified in Resend) |
| `ADMIN_CODE` | Enables `/admin?code=…`, a backup view of every saved submission |
| `DATA_DIR` | Where submissions are stored (mount a volume here, e.g. `/data`) |

Questions live in `public/questions.js`, which both the page and the email formatter use.
