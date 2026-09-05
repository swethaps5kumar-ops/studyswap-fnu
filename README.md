# StudySwap FNU

A campus marketplace where FNU students register with their student email,
verify with an emailed OTP, get approved by an admin, then list items for
sale, search listings, chat with buyers/sellers, reserve items, and mark
them sold.

## Stack
- **Backend:** Node.js + Express, SQLite (via `better-sqlite3`), session-based auth, `nodemailer` for OTP emails
- **Frontend:** Plain HTML/CSS/JS (no build step) served as static files by Express

## Project structure
```
studyswap-fnu/
  server/
    server.js          # app entry point
    db.js               # SQLite schema
    seedAdmin.js         # creates the first admin account
    routes/              # auth, admin, listings, chat
    middleware/auth.js
    utils/               # otp + mailer helpers
  public/                # frontend (index, register, login, dashboard, listing, admin)
  .env.example
  package.json
```

## 1. Run it locally

1. Install Node.js 18+ from https://nodejs.org if you don't have it.
2. Open a terminal in the `studyswap-fnu` folder and install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in the values:
   ```
   cp .env.example .env
   ```
   - `SESSION_SECRET`: any long random string
   - `EMAIL_USER` / `EMAIL_PASS`: an account that can send the OTP emails (see below)
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD`: the login for your first admin account
   - `STUDENT_EMAIL_DOMAIN` *(optional)*: add this line, e.g. `STUDENT_EMAIL_DOMAIN=@fnu.edu`, to only allow registrations from that domain

   **Setting up the OTP email (Gmail example):**
   - Turn on 2-Step Verification on the Gmail account you want to send from
   - Go to https://myaccount.google.com/apppasswords and create an "App Password"
   - Use that 16-character password as `EMAIL_PASS` (not your normal Gmail password)
   - If you leave `EMAIL_USER`/`EMAIL_PASS` blank, the app still works — OTP codes are printed to the terminal instead of emailed, which is handy while testing.

4. Create the admin account:
   ```
   npm run seed-admin
   ```
5. Start the server:
   ```
   npm start
   ```
6. Open http://localhost:3000 in your browser.
   - Register a student account (or several, in an incognito window) to test the flow.
   - Log in as the admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) at the same login page — it routes admins to the admin console automatically.

## 2. How the approval flow works
1. Student registers with first name, last name, student email, and a password.
2. A 6-digit OTP is emailed to them (or printed to the console if email isn't configured).
3. Student enters the OTP → their account is marked "email verified."
4. An admin opens the **Pending approvals** tab and approves the account.
5. Only after both steps can the student log in.

## 3. Launching it on the web

The simplest path is a small always-on Node host. **Render.com** is a good
free option:

1. Push this folder to a GitHub repository.
2. Go to https://render.com → New → Web Service → connect your repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Add the same variables from your `.env` file under the service's
   **Environment** tab (`SESSION_SECRET`, `EMAIL_USER`, `EMAIL_PASS`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, etc.), plus `TRUST_PROXY=true`.
5. **Important — database persistence:** this app stores data in a local
   file (`data.db`). Render's free web services use an ephemeral disk, so
   the database resets on every redeploy/restart. For an assignment demo
   this is usually fine, but if you need the data to persist:
   - Add a Render **Persistent Disk** (Render dashboard → your service →
     Disks) mounted at, e.g., `/data`, and set an env var so `db.js` writes
     there instead — or
   - Swap SQLite for a managed database (Render/Railway/Supabase all offer
     free Postgres) later on.
6. After the first deploy, open a **Shell** tab on Render for your service
   and run `npm run seed-admin` once to create the admin account (it reads
   `ADMIN_EMAIL`/`ADMIN_PASSWORD` from your environment variables).
7. Your site will be live at the `.onrender.com` URL Render gives you.

**Alternatives:** Railway.app and Fly.io work the same way (connect repo,
set env vars, add a volume for persistence). Avoid static-only hosts like
GitHub Pages or Netlify's free tier for the backend — this app needs a
persistent Node server to handle sessions, OTP emails, and the database.

## Notes / possible follow-ups
- Passwords are hashed with bcrypt; sessions are stored server-side (in
  memory by default — fine for a class project; swap in a store like
  `connect-sqlite3` if you need sessions to survive server restarts).
- Chat refreshes every 4 seconds by polling; it's not WebSocket-based, so
  it works on any host without extra configuration.
- The admin can revoke an approved student's access without deleting the
  account, in addition to approving and removing users.
