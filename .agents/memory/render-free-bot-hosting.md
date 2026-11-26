---
name: Render free hosting for Telegram bots
description: How to host a polling Telegram bot on Render for free after the background worker tier was removed
---

# Render free hosting for Telegram bots

**Rule:** Render no longer offers a free background worker. A free Telegram bot must be deployed as a Render free web service.

**What you must do:**
1. Add a lightweight health endpoint to the bot process (e.g., aiohttp or Flask) that listens on the `PORT` env var and serves at least `/` and `/health`.
2. In `render.yaml`, set `healthCheckPath: /health` so Render's health checks do not hit a 404.
3. Keep the service awake with a free pinger such as UptimeRobot, because Render free web services sleep after ~15 minutes of inactivity.
4. Parse `PORT` safely with a fallback, and skip the health server when `PORT` is absent (local/Replit mode).

**Why:** Without an explicit `healthCheckPath`, Render defaults to checking `/`, which can fail even if the bot is polling correctly. Without a pinger, the free web service will sleep and stop the polling loop.

**How to apply:** Use this pattern whenever a Telegram bot needs free 24/7 hosting on Render, regardless of whether it uses polling or webhooks.