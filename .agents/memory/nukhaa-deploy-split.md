---
name: Nukhaa deploy split
description: Why the project is split between Render (bot) and PythonAnywhere (Mini App), and what each service needs.
---

- **Bot (`main.py`)** runs on a **Render free web service** with a `/health` endpoint and an external pinger (UptimeRobot) to prevent sleep.
- **Mini App (`files_mini_app/app.py`)** runs on a **PythonAnywhere free web app** to get a stable URL: `https://<username>.pythonanywhere.com`.

**Why this split:**
Telegram's Mini App URL (set in @BotFather) and Google's OAuth redirect URI must be registered once. Replit's development domain changes across restarts, forcing repeated updates. PythonAnywhere gives a persistent subdomain on the free tier, solving that without a custom domain or paid plan.

**Shared requirements:**
Both services must use the same `TOKEN`, `OWNER_ID`, and `SUPABASE_DB_URL`. The Mini App additionally needs `OWNER_KEY`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`.

**Why not both on Render:**
Render free web services sleep after inactivity and require a pinger per service. Keeping the bot on Render and the Mini App on PythonAnywhere gives a stable URL for the Mini App with fewer moving parts for the web app.
