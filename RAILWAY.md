# Deploy Nukhaa Bot + Mini App on Railway (One Service)

This guide runs **both the bot and the Mini App in a single Railway service** using one start command.

**Why one service?**
- Uses only one Railway service, so you save free-tier credits.
- One URL for the Mini App.
- One auto-deploy on every `git push`.
- The `run_both.py` script starts the bot and the Mini App together and restarts everything if one fails.

**Important:** Railway's free tier has limits. For a production platform with many users, move to a paid plan or a VPS.

---

## Prerequisites

1. GitHub repo pushed:
   ```
   https://github.com/noqta23/NukhaaPlatform
   ```
2. Railway account: [railway.app](https://railway.app)
3. Environment variables (same for bot and Mini App):
   - `TOKEN`
   - `OWNER_ID`
   - `OWNER_KEY`
   - `SUPABASE_DB_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET` (optional but recommended)

---

## Step 1 — Create a Railway project

1. Go to [railway.app](https://railway.app) and log in.
2. Click **New Project**.
3. Choose **Deploy from GitHub repo**.
4. Select: `noqta23/NukhaaPlatform`.

---

## Step 2 — Set the Root Directory

The service must deploy from the project root because `run_both.py` and `railway.toml` are there:

1. Click the service in the Railway dashboard.
2. Go to **Settings** → **Root Directory**.
3. Enter:
   ```
   /
   ```
4. Click **Deploy** if needed.

Railway reads `railway.toml`, `requirements.txt`, and `run_both.py` from the project root.

---

## Step 3 — Add Environment Variables

1. Click the service → **Variables**.
2. Add each variable:

| Variable | Value | Used by |
|----------|-------|---------|
| `TOKEN` | Telegram bot token from @BotFather | Bot + Mini App |
| `OWNER_ID` | Your Telegram user ID | Bot + Mini App |
| `OWNER_KEY` | Secret password for owner login | Bot + Mini App |
| `SUPABASE_DB_URL` | Supabase connection string | Bot + Mini App |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | Mini App |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | Mini App |
| `GOOGLE_REDIRECT_URI` | `https://<your-service>.up.railway.app/api/google/callback` | Mini App (Google OAuth) |
| `WEBAPP_URL` | `https://<your-service>.up.railway.app` | Mini App (inline buttons) |
| `MINI_APP_TELEGRAM_LINK` | `https://t.me/<your_bot>/<short_name>` | Mini App (return after Google OAuth) |
| `SESSION_SECRET` | Long random string | Mini App |

3. Railway will redeploy automatically.

---

## Step 4 — Verify the Start Command

Railway should read the start command from `railway.toml`:

```bash
python run_both.py
```

If it does not, set it manually in the service **Settings** → **Start Command**.

What `run_both.py` does:
1. Starts the bot in a subprocess (`python main.py`) **without** `PORT`, so it does not start a health server.
2. Starts the Mini App in a subprocess with `gunicorn`, binding to Railway's `$PORT`.
3. If either process exits, it shuts down the whole service so Railway can restart it.

---

## Step 5 — Deploy

1. Railway deploys automatically after you set the root directory and variables.
2. Wait for the deployment to finish.
3. Check the **Deployments** tab for build errors.

---

## Step 6 — Get the URL and Update Telegram

1. Railway gives you one public URL for the Mini App, for example:
   ```
   https://nukhaa-platform.up.railway.app
   ```
2. Copy this URL.
3. Go to **@BotFather** → your bot → **Bot Settings** → **Menu Button**.
4. Paste the URL as the Mini App URL.
5. In **Google Cloud Console** → **APIs & Services** → **Credentials**, add:
   ```
   https://nukhaa-platform.up.railway.app/api/google/callback
   ```
   to the **Authorized redirect URIs**.

---

## Step 7 — Stop the Old Render Bot (Important)

The bot is now running inside the Railway service. Stop the old Render service so only one bot is polling Telegram:

1. Go to your Render dashboard.
2. Find the bot service.
3. Suspend or delete it.

Running two bots with the same token will cause duplicate messages and webhook conflicts.

---

## Step 8 — Updating the code

Every time you push changes to GitHub, Railway auto-deploys:

```bash
git add .
git commit -m "update"
git push origin main
```

After 1–2 minutes, both the bot and Mini App are updated.

---

## Alternative: Two separate Railway services

If you prefer to keep the bot and Mini App in separate services (for example, to scale them independently later):

1. Create a service for the bot with root directory `/` and start command `python main.py`.
2. Create a service for the Mini App with root directory `files_mini_app` and start command `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 60`.
3. Share variables at the project level.

This uses more Railway credits but gives you more control.

---

## Free tier limits

Railway's free tier is generous for testing but has limits:
- Limited execution hours and resources per month.
- Service may stop if you exceed the free credits.
- Bandwidth is limited.

For a platform with thousands of users, upgrade to Railway's paid plan or move to a VPS.

---

## Troubleshooting

| Problem | Cause | Fix |
|--------|-------|-----|
| Build fails | Missing dependency | Check `requirements.txt` includes `gunicorn` and `yt-dlp` |
| `ModuleNotFoundError` | Wrong root directory | Set Root Directory to `/` |
| `SUPABASE_DB_URL not set` | Missing env var | Add `SUPABASE_DB_URL` in Railway Variables |
| Supabase connection refused | SSL or wrong port | The code adds `sslmode=require` automatically |
| Mini App URL does not match | BotFather URL mismatch | Copy the exact Railway URL into BotFather |
| Two bots respond at once | Bot running on Render and Railway | Suspend the old Render service |
| Bot logs are missing | `run_both.py` streams both | Check Railway logs for `[BOT]` and `[WEB]` prefixes |

---

## Moving to production

When you are ready to scale, move to a paid VPS such as:
- **Hetzner Cloud**: ~$7/month
- **DigitalOcean**: ~$6/month
- **Hostinger VPS**: ~$6.5/month

See `Render + PythonAnyWhere.md` for the full production deployment guide.
