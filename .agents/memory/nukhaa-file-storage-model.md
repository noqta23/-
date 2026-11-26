---
name: Nukhaa file storage model
description: How the Nukhaa files mini-app persists binaries (Telegram-as-storage) — required context before touching upload-from-url / download logic.
---

The app has no local filesystem or object storage for binaries. Every real file lives inside
Telegram itself: `upload_file()` reads raw bytes and POSTs them to the bot's `sendDocument` API,
gets back a real Telegram `file_id`, and that `file_id` (not a generated UUID) becomes the
record's `file_id` in the files store. Serving/streaming later resolves that `file_id` through
Telegram's `getFile` API (`/api/download/<file_id>`, `/api/files/<file_id>/thumb`).

**Why this matters:** a "download from URL" feature must follow the same pattern to be a real
download — fetch the actual bytes, POST them to Telegram via `sendDocument`, and store the
returned `file_id`. Just storing the remote URL in a `url` field (even under a `mode=download`
flag) is indistinguishable from `mode=link` and is not a real download — it was the root cause of
a "download never downloads" bug.

**How to apply:**
- Telegram Bot API's public `sendDocument` has a practical ~50MB ceiling; use a safety margin
  (this app uses 45MB) and cap streamed reads at that limit.
- `sendDocument` requires a `chat_id` that has actually started a conversation with the bot —
  testing with an arbitrary/fake `user_id` will silently fail with `ok:false` from Telegram (not
  an exception), which looks identical to "download failed" during manual testing. Use a real
  owner/admin chat id when testing upload-from-url download paths locally.
- On any failure (size cap, fetch error, Telegram rejection), fall back to saving as a link with
  an explicit, distinct message explaining why — never fail silently or pretend success.
- yt-dlp on cloud/datacenter IPs frequently hits YouTube's "Sign in to confirm you're not a bot"
  wall for single-video downloads; treat this as an expected, not-fully-fixable environment
  limitation and make sure the fallback-to-link path is clean rather than trying to defeat it.
