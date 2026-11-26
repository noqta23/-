# Deploy Nukhaa Bot + Mini App

This guide covers multiple deployment options:
- **Render** for the bot (free web service)
- **PythonAnywhere** for the Flask Mini App (free web app)
- **Railway** for testing the Mini App or the whole platform (free tier, easier than PythonAnywhere)

> **Recommended for testing:** Use `RAILWAY.md` to deploy the Mini App on Railway quickly. It is easier than PythonAnywhere and gives you a stable URL without sleeping issues.
>
> **Recommended for production:** Use a cheap VPS (Hetzner, DigitalOcean, or Hostinger) for both the bot and Mini App.

> **Important:** Render no longer offers a free background worker. The bot now runs as a **Render free web service**. Free web services sleep after ~15 minutes of inactivity, so use a free pinger such as **UptimeRobot** to keep the bot alive (explained in Step 2).
>
> **Important:** PythonAnywhere's free tier has outbound network restrictions. The Mini App calls the Telegram API for thumbnails and file downloads, which may fail on the free tier. Test it first. If Telegram API calls fail, the easiest fully-free alternative is to host the Mini App on another platform (see the Alternative section).

---

## What runs where

| Service | File | Platform | Why |
|--------|------|----------|-----|
| Bot | `main.py` | Render Web Service (free) | Polling bot + `/health` endpoint; kept awake by UptimeRobot |
| Mini App | `files_mini_app/app.py` | PythonAnywhere Web App (free) | Stable URL but manual deploy |
| Mini App (testing) | `files_mini_app/app.py` | Railway (free tier) | Stable URL, auto-deploy, no sleeping; see `RAILWAY.md` |

---

## Required environment variables

Both services must share the same values for these variables.

| Variable | Used by | Where to get it |
|----------|---------|-----------------|
| `TOKEN` | Bot + Mini App | Telegram @BotFather → API token |
| `OWNER_ID` | Bot + Mini App | Your Telegram user ID (numbers only) |
| `OWNER_KEY` | Mini App | A secret password/phrase for the owner login |
| `SUPABASE_DB_URL` | Bot + Mini App | Supabase Project Settings → Database → Connection string |
| `SESSION_SECRET` | Mini App | A long random string for Flask sessions (optional but recommended) |
| `GOOGLE_CLIENT_ID` | Mini App | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Mini App | Google Cloud Console → APIs & Services → Credentials |

Optional:
| `APP_SHORT_NAME` | Mini App | Short name for Telegram menu button (defaults to empty) |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | PythonAnywhere sync | GitHub token for pulling code updates easily |

---

## Step 1 — Push the project from Replit to GitHub

The project is already connected to GitHub as:

```
https://github.com/noqta23/NukhaaPlatform.git
```

In your Replit project, open the **Shell** tab and run:

```bash
git add .
git commit -m "Prepare PythonAnywhere deploy"
git push origin main
```

Every time you change code later, run the same three commands to push the update to GitHub.

---

## Step 2 — Set up the Bot on Render

1. Go to [render.com](https://render.com) and create a free account.
2. Click **New +** → **Web Service**.
3. Choose **Build and deploy from a Git repository**.
4. Connect your GitHub repo: `noqta23/NukhaaPlatform`.
5. Render will read `render.yaml` from the repo. Confirm these settings:
   - **Name**: `nukhaa-bot`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py`
   - **Plan**: Free
   - **Health Check Path**: `/health` (already set in `render.yaml`)
6. Go to the **Environment** tab and add:
   - `TOKEN`
   - `OWNER_ID`
   - `SUPABASE_DB_URL`
7. Click **Deploy**. The bot will start polling and expose a health check endpoint at `/health`.

## Step 2.5 — Keep the bot awake with UptimeRobot

Render free web services sleep after ~15 minutes of inactivity. To keep the bot running 24/7:

1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account.
2. Add a new monitor:
   - **Monitor Type**: HTTP(s)
   - **URL**: your Render service URL + `/health`, e.g. `https://nukhaa-bot.onrender.com/health`
   - **Monitoring Interval**: 5 minutes (free tier)
3. Save the monitor. UptimeRobot will ping the bot every 5 minutes, preventing it from sleeping.

---

## Step 3 — Set up the Mini App on PythonAnywhere

Your PythonAnywhere username is `noqta23`, so your Mini App URL will be:

```
https://noqta23.pythonanywhere.com
```

1. Go to [pythonanywhere.com](https://www.pythonanywhere.com) and create a free account (or log in with `noqta23`).
2. Open a **Bash console** and clone your repo:
   ```bash
   git clone https://github.com/noqta23/NukhaaPlatform.git
   ```
   - If GitHub asks for a username and password, it is asking for your GitHub credentials. Use your GitHub username and a **Personal Access Token** (not your GitHub password). See the note below about creating a token.
   - If the repository is public, this step usually works without a password prompt.
### If the clone asks for a password

GitHub removed password authentication for Git over HTTPS. If the prompt appears, use a **Personal Access Token** as the password:

1. In GitHub, go to **Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Click **Generate new token**.
3. Select at least the **repo** scope (read access to your repositories).
4. Copy the token.
5. In PythonAnywhere, when the prompt asks for the password, paste the token (not your GitHub password).

Store that same token in your PythonAnywhere environment variables as `GITHUB_PERSONAL_ACCESS_TOKEN` so you can use it for future `git pull` updates.

3. Go to **Web** → **Add a new web app**.
   - Choose **Manual configuration** (or **Flask** if available, but we will override the WSGI file).
   - Choose **Python 3.11**.
4. In the web app dashboard, set:
   - **Working directory**: `/home/noqta23/NukhaaPlatform/files_mini_app`
   - **Virtualenv path**: `/home/noqta23/.virtualenvs/nukhaa` (create one in a Bash console as shown below)

   Create the virtualenv and install requirements:
   ```bash
   rmvirtualenv nukhaa   # only if the old one is broken
   mkvirtualenv --python=python3.10 nukhaa
   pip install -r /home/noqta23/NukhaaPlatform/files_mini_app/requirements.txt
   ```
   If you see `ModuleNotFoundError: No module named '_posixsubprocess'`, the virtualenv is broken. Delete it and recreate it with `python3.10 -m venv` instead:
   ```bash
   deactivate
   rm -rf /home/noqta23/.virtualenvs/nukhaa
   python3.10 -m venv /home/noqta23/.virtualenvs/nukhaa
   source /home/noqta23/.virtualenvs/nukhaa/bin/activate
   pip install -r /home/noqta23/NukhaaPlatform/files_mini_app/requirements.txt
   ```
   When you create the web app, choose **Python 3.10** to match the virtualenv.
5. Click the **WSGI configuration file** link in the dashboard. It will be something like `/var/www/noqta23_pythonanywhere_com_wsgi.py`.
6. Replace the entire contents of that file with the contents of `files_mini_app/wsgi.py` from the repo (already set to `noqta23` and `NukhaaPlatform`), OR paste this directly:
   ```python
   import sys
   sys.path.insert(0, '/home/noqta23/NukhaaPlatform/files_mini_app')
   from app import app as application
   ```
7. Go to the **Environment variables** section and add:
   - `TOKEN`
   - `OWNER_ID`
   - `OWNER_KEY`
   - `SUPABASE_DB_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET` (optional but recommended: a long random string, kept constant)
8. Click **Reload**.

---

## Step 4 — Update your Mini App URL in Telegram and Google

1. In PythonAnywhere, copy your web app URL: `https://noqta23.pythonanywhere.com`.
2. Go to **@BotFather** → `/mybots` → your bot → **Bot Settings** → **Menu Button** → **Configure menu button**.
3. Paste the URL.
4. In **Google Cloud Console** → **APIs & Services** → **Credentials** → **OAuth 2.0 Client IDs**, add the same URL plus `/api/google/callback` to **Authorized redirect URIs**:
   ```
   https://noqta23.pythonanywhere.com/api/google/callback
   ```
5. Now the Mini App button opens the live PythonAnywhere web app, and Google OAuth works without changing the URL every time.

---

## Step 5 — Updating after changes

- **Render** auto-deploys on every `git push`.
- **PythonAnywhere** does **not** auto-deploy on the free tier. After you push:
  - Pull the latest code inside your PythonAnywhere Bash console:
    ```bash
    cd /home/noqta23/NukhaaPlatform
    git pull origin main
    ```
  - Then click **Reload** on the PythonAnywhere web app dashboard.

For faster updates, you can use PythonAnywhere's paid tier or switch the Mini App to a Render web service (see below).

---

## Alternative: host the Mini App on Render too

If PythonAnywhere's free tier blocks Telegram API calls, or if you want automatic deploys for the Mini App, you can host it on Render as a web service:

1. Create a second service on Render:
   - **Type**: Web Service
   - **Name**: `nukhaa-mini-app`
   - **Root Directory**: `files_mini_app`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 60`
2. Add the same environment variables.
3. Render free web services sleep after ~15 minutes of inactivity. Add another free UptimeRobot monitor for the Mini App URL.
4. Check your Render dashboard for free plan limits; some free plans allow only one free web service.

---

## Troubleshooting

| Problem | Cause | Fix |
|--------|-------|-----|
| Bot not responding | Render service sleeping or `TOKEN` missing | Check Render logs, env vars, and UptimeRobot monitor |
| Mini App shows "Forbidden" | Telegram Mini App URL does not match | Make sure the URL in BotFather matches your PythonAnywhere/Render URL exactly |
| Owner login fails | `OWNER_KEY` missing | Add `OWNER_KEY` in PythonAnywhere environment variables |
| Files uploaded via bot not showing in Mini App | Different Supabase projects | Use the same `SUPABASE_DB_URL` on both services |
| Telegram thumbnails/file previews fail | PythonAnywhere free tier blocks Telegram API | Switch the Mini App to another platform (see Alternative) |
| Bot stops after a while | Render free web service sleeps after inactivity | Add an UptimeRobot monitor for `/health` |
| Google OAuth fails | Missing redirect URI or wrong URL | Add `https://noqta23.pythonanywhere.com/api/google/callback` in Google Cloud Console |
| Supabase connection refused | Missing `sslmode=require` or wrong port | Use the connection string from Supabase dashboard; the code now adds `sslmode=require` automatically |
| `ModuleNotFoundError: No module named 'psycopg2'` | `psycopg2-binary` not installed | Run `pip install psycopg2-binary` inside the virtualenv, or reinstall with the updated `requirements.txt` |

---

## Important notes

- Keep your `SUPABASE_DB_URL`, `OWNER_KEY`, and `GOOGLE_CLIENT_SECRET` secret. Never commit them to GitHub.
- The bot and Mini App must share the same Supabase project to see the same data.
- Both `TOKEN` and `OWNER_ID` must match between the bot and Mini App.
- The PythonAnywhere URL is stable: `https://noqta23.pythonanywhere.com`. Register it once in Telegram and Google, and it will keep working after code updates.

---

## Copying to another Replit account

Because the project is in GitHub, you can import it into any Replit account. After importing, you must set up the environment variables again because Replit Secrets and `.env` files are not copied through GitHub.

1. In the new Replit account, create a new repl from your GitHub repo.
2. Copy `.env.example` to `.env` and fill in your real values (or use Replit Secrets for better security).
3. The same `TOKEN` can be used in multiple accounts, but **never run the bot in two places at the same time** — Telegram only allows one active polling connection per bot. Stop the old Replit workflow before starting the new one.
4. Because data is stored in Supabase, the new account will see the same files/folders as long as it uses the same `SUPABASE_DB_URL`.
5. The Mini App URL will change for the new Replit account. Update it in @BotFather → your bot → Menu Button.
