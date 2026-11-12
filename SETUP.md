# Team Hub · setup

Team Hub runs in two modes:

- **Demo mode** (no setup): data is saved in your browser only. Good for looking around.
- **Shared mode**: everyone signs in with their work email and sees the same data, live.
  Needs a free Supabase project. Takes about 15 minutes, done once.

---

## 1. Run it on a laptop

```bash
npm install
npm run dev
```

Open http://localhost:5173. With no `.env.local` file it starts in demo mode.

## 2. Create the database (Supabase, free)

1. Go to https://supabase.com, sign in, **New project**.
   Name it `team-hub`, pick region **Mumbai (ap-south-1)**, save the database password somewhere safe.
2. When it's ready, open **SQL Editor → New query**.
3. Paste everything from `supabase/schema.sql` and click **Run**.
4. New query again: paste `supabase/seed.sql`, click **Run**.
   This loads the 16 team members, 26 clients, open tasks, the 12 Nov updates and the November post calendar.

## 3. Sign-in settings

In Supabase → **Authentication**:

1. **Sign In / Providers → Email**: enabled, **Confirm email** on.
2. **URL Configuration**:
   - Site URL: your Team Hub web address (e.g. `https://team-hub.vercel.app`)
   - Redirect URLs: add the same address, plus `http://localhost:5173`

## 4. Connect the app to the database

In Supabase → **Project Settings → API**, copy the **Project URL** and the **anon public** key.

- **On each laptop**: copy `.env.example` to `.env.local` and paste both values.
- **On Vercel** (the live site): Project → Settings → Environment Variables → add
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
  (`vercel.json` is already in the repo so page links like `/clients/C-06` work.)

The anon key is safe to put in the website: the database rules in `schema.sql` block anyone
who is not an active team member.

## 5. Emails (task alerts, sign-up and password reset)

All email goes through **Resend** (free up to 3,000 emails a month).

1. Sign up at https://resend.com → **Domains → Add domain** → `brandmaker333.com`.
   Add the DNS records it shows at your domain provider and wait for **Verified**.
2. **API Keys → Create** and copy the key.
3. **Sign-up and reset emails** (Supabase's own sender only allows a few emails an hour):
   Supabase → Authentication → **Emails → SMTP Settings** → enable custom SMTP:
   - Host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key
   - Sender email `teamhub@brandmaker333.com`, sender name `Team Hub`
4. **Task alert function**: Supabase → **Edge Functions → Deploy a new function → Via editor**.
   Name it `notify-assignment`, paste `supabase/functions/notify-assignment/index.ts`, deploy.
5. Edge Functions → **Secrets**, add:
   - `RESEND_API_KEY` = the Resend key
   - `MAIL_FROM` = `Team Hub <teamhub@brandmaker333.com>`
   - `APP_URL` = your Team Hub web address
   - `WEBHOOK_SECRET` = any long random text
6. Supabase → **Database → Webhooks → Create a new hook**:
   - Table `tasks`, events **Insert** and **Update**
   - Type **Supabase Edge Functions**, function `notify-assignment`
   - Add header `x-webhook-secret` = the same text as `WEBHOOK_SECRET`

Now when someone gives a task to a teammate (new or reassigned), the teammate gets an email
with the task, client, due date and an **Open the task** button.

## 6. First sign-in

1. Bidhan opens Team Hub → **First time? Create password** → types `bidhan` → sets a password →
   clicks the link in the confirmation email.
2. Everyone else does the same with their first name.
   Logins are `firstname@brandmaker333.com`. Only emails listed in **Admin → People** can sign up.

## Everyday admin

- **Add someone**: Admin → People → Add person. Their email fills in from the first name.
- **Someone leaves**: edit them and tick **Left the team**. They can't sign in; their history stays.
- **New admin** (e.g. Nilima, Karishma): add or edit them and set Access to **Admin**.
- **Client changes**: Admin → Clients, or the **Edit** button on any client page.

## Changing the starting data

`src/store/seed.js` holds the demo data. After editing it, run `node scripts/make-seed-sql.mjs`
to rebuild `supabase/seed.sql`. (The seed only adds missing rows; it never overwrites live data.)
