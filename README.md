# Deal Team 6

The team's shared book of people we trust, lease comps we've seen, and the tools we use. It replaces the "Deal Team 6 - Tools and Resources" spreadsheet.

## What's in it

- **Directory.** Every vendor, lender, attorney, contractor and referral partner, grouped by what they do. Search by name, company or need. Each person shows who on the team knows them, whether they're a preferred go-to, and whether they pay referrals. Call, email, copy their details for a client, or save them to your phone in one tap.
- **Scan cards.** Photograph a business card (or a whole stack laid out on a desk). Claude reads each card and fills in the details; you check them and save. Duplicates are flagged before they're saved.
- **Lease Comps.** Office and retail comps with filters for type, area, lease type and date. The chart puts every comp on a $/SF line with the median marked, so the going rate is obvious at a glance. Export what you filtered to CSV.
- **Calculators.** Loan and ROE (the spreadsheet's calculator, with a rent roll builder), Max loan (DSCR and LTV sizing), and Cap rate.
- **Resources.** Grant programs and the websites the team keeps looking up.

Anyone on the team can add or edit anything. Every record shows who added it and who last changed it. "Remove" hides a record rather than deleting it, so anything can be restored.

## Using it

1. Open the team link and enter your name and the team passcode. You stay signed in on that device.
2. On your phone, add it to your home screen (Safari: Share, then Add to Home Screen) so the card scanner is one tap away.

## How it's built

| Part | What it does |
|---|---|
| `src/` | The website (React + TypeScript, built with Vite). |
| `supabase/schema.sql` | The database: tables, access rules, the card photo bucket. |
| `supabase/functions/scan-card/` | The card scanner. Sends the photo to Claude and returns the details. |
| `scripts/import_excel.py` | One-time import of the original spreadsheet. |
| `.github/workflows/` | Publishes the site to GitHub Pages on every push, and keeps the free database awake. |

Real contact data lives only in Supabase. The spreadsheet and the imported data files are kept out of this repository by `.gitignore`.

First-time setup is in [SETUP.md](SETUP.md).

## Working on it locally

```bash
npm install
npm run dev
```

Without Supabase settings it runs in demo mode: data stays in your browser. To test the scanner locally, put `ANTHROPIC_API_KEY=...` in `.env.local` (see `.env.example`).
