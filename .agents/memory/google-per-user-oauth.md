---
name: Google per-user OAuth
---

Nukhaa links Google Drive / Classroom **per user**, not per app/service account.

- Client credentials are `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` secrets.
- OAuth callback: `https://<REPLIT_DEV_DOMAIN>/api/google/callback`
- Add that URI (and the production deployment URI) to the Google Cloud Console OAuth Web client.
- The app requests `access_type=offline` + `prompt=consent` so we get a refresh token for background uploads.
- Tokens live in `google_tokens` Supabase collection, keyed by Telegram user id.
- Uses plain `requests` with Drive/Classroom REST APIs; no heavy Google SDK.

**Why:** Each user sees their own Drive/Classroom files, so tokens must be user-scoped. The free `refresh_token` is the only way to upload a Drive folder later without the user being present.
