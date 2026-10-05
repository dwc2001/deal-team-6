# Setup

## Already done

- Supabase project **Deal Team 6** holds the database: tables, access rules, and the private bucket for card photos.
- The spreadsheet is loaded: 61 people in 31 services, 56 lease comps, 10 links.
- Sign-ups are turned off, so the team login is the only account that can exist.
- The card scanner is deployed (`scan-card`). It refuses anyone not signed in as the team.
- The website at https://dwc2001.github.io/deal-team-6/ is connected to the database.

## Left to do (you)

### 1. Set the team passcode (2 minutes)

1. Open https://supabase.com/dashboard/project/nkqbwfcoqmthgsyfvqtc/auth/users
2. Click **Add user**, then **Create new user**.
3. Email: `team@dealteam6.app` (it never receives mail; it's only the login's name).
4. Password: the team passcode. At least 10 characters, something easy to say out loud.
5. Check **Auto Confirm User**, then **Create user**.

Now anyone with the link and the passcode can sign in. To change the passcode later (say someone leaves), click that user and set a new password.

### 2. Turn on the card scanner (5 minutes)

1. Go to https://console.anthropic.com and sign in or create an account.
2. Under **Billing**, add credit ($5 covers roughly 200 cards) and set a monthly limit.
3. Under **API Keys**, click **Create Key** and copy it.
4. Open https://supabase.com/dashboard/project/nkqbwfcoqmthgsyfvqtc/functions/secrets
5. Add a secret named `ANTHROPIC_API_KEY` and paste the key as its value. Save.

Scanning works right away; nothing needs redeploying.

If scanning says the key "isn't tied to a workspace", the key was made at the organization level. Either add a second secret `ANTHROPIC_WORKSPACE_ID` with your workspace ID (starts with `wrkspc_`, found under **Settings > Workspaces** in the Anthropic Console), or create a new key from inside a workspace and replace `ANTHROPIC_API_KEY` with it.

## For later

- **Redeploy the scanner** after changing it: `npx supabase functions deploy scan-card --project-ref nkqbwfcoqmthgsyfvqtc --use-api`
- **Spend less per card:** add a secret `CARD_SCAN_MODEL` = `claude-sonnet-5-5`.
- **The website** redeploys itself on every push to `main`.
- **Free plan pausing:** Supabase pauses free projects after a week without use. The "Keep database awake" workflow pings it every three days.
