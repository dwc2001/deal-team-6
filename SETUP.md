# One-time setup

About 20 minutes. You need three free accounts: GitHub (you have it), Supabase, and an Anthropic API account for the card scanner.

## 1. Create the database (Supabase)

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project.
   - Name: `deal-team-6`
   - Region: East US
   - Save the database password somewhere safe (you won't need it day to day).
2. In the project, open **SQL Editor**, paste all of `supabase/schema.sql`, and click **Run**.
3. Load the spreadsheet: open a new query, paste all of `supabase/seed.local.sql`, and click **Run**.
   - That file is on your computer only. If it's missing, run `python scripts/import_excel.py` first.

## 2. Set the team passcode

1. Open **Authentication > Sign In / Providers** and turn **off** "Allow new users to sign up". Only the team login should exist.
2. Open **Authentication > Users > Add user > Create new user**.
   - Email: `team@dealteam6.app` (it never receives mail; it's just the login's name)
   - Password: the team passcode. Make it at least 10 characters.
   - Check **Auto Confirm User**.

To change the passcode later (say someone leaves), edit this user's password. From then on, signing in takes the new passcode.

## 3. Turn on the card scanner

1. Create an API key at [console.anthropic.com](https://console.anthropic.com) under **API Keys**. Set a monthly spend limit under **Billing** (each card costs two to three cents).
2. In Supabase, open **Edge Functions > Secrets** and add `ANTHROPIC_API_KEY` with that key.
3. Deploy the scanner. In a terminal in this folder:

```bash
npx supabase login
```

Then tell Claude it's done, or run these yourself (your project ref is in the Supabase URL, `https://<ref>.supabase.co`):

```bash
npx supabase functions deploy scan-card --project-ref YOUR_PROJECT_REF --use-api
```

## 4. Connect the website

1. In Supabase, open **Project Settings > API** and copy the **Project URL** and the **publishable (anon) key**. Both are safe to put in a website; the access rules in step 1 are what protect the data.
2. In the GitHub repository, open **Settings > Secrets and variables > Actions > Variables** and add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the publishable key
3. Open **Settings > Pages** and set **Source** to **GitHub Actions**.
4. Open **Actions**, pick **Deploy site**, and click **Run workflow**. In a minute the site is live at the address shown on the Pages screen.

Send the team the link and the passcode. That's it.
