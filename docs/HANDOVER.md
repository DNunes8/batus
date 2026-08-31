# Hand-off guide

Single-purpose doc: how to transfer Batus from Diogo's hands to Baltaru's, cleanly and permanently.

## What Baltaru ends up owning

| Service | Account | What it does |
|---|---|---|
| Cloudflare | `batusboxing@gmail.com` | Hosts the app and serves the DNS (free tier) |
| Supabase | `batusboxing@gmail.com` | Database, auth, storage (free tier) |
| Resend | `batusboxing@gmail.com` | Transactional email (free tier, 3k/mo) |
| Vercel | `batusboxing@gmail.com` | **Domain registrar only** — batusboxe.com renews here (~May 2027) |
| GitHub | `DNunes8` | Source code (public) + the two scheduled jobs |
| Gmail (`batusboxing@gmail.com`) | Baltaru | The umbrella account billing alerts arrive at |

Source code lives at `github.com/DNunes8/batus` (public). Baltaru does NOT need a GitHub account to run the app — only if he ever hires a developer to extend it.

The app has been hosted on Vercel, then Netlify, then Cloudflare. Only the
domain registration was left behind at Vercel; nameservers point at Cloudflare.

## How a deploy works

There is no CI deploy. Someone with a clone runs:

```bash
npm run deploy
```

That builds and uploads in one step. `opennextjs-cloudflare deploy` on its own
does **not** rebuild — it shipped a stale bundle once.

To deploy from a fresh machine you need:

1. `npm install` and Node 22 (`nvm use`).
2. `npx wrangler login` with the `batusboxing@gmail.com` Cloudflare account.
3. A `.env.local` with the two `NEXT_PUBLIC_SUPABASE_*` values — they are
   compiled into the browser bundle, so the build machine must have them. Copy
   them from Supabase → Project Settings → API.

Everything else (service role key, Resend key, cron secret) already lives as a
Cloudflare secret and is read at runtime — `npx wrangler secret list` shows
them. A new machine does not need those values to ship a working deploy.

## Database changes

Migrations in `supabase/migrations/` are applied **by hand** in the Supabase SQL
editor. Nothing runs them automatically. Apply the SQL, confirm it worked, then
deploy the code.

## The two scheduled jobs

Both are GitHub Actions, not Cloudflare crons:

- `payment-reminders.yml` — 09:00 UTC on the 8th, calls
  `/api/cron/payment-reminders` with the shared `CRON_SECRET`.
- `backup.yml` — Mondays 04:00 UTC, encrypted `pg_dump` kept as a 90-day
  artifact. It also pushes an empty keepalive commit, because GitHub disables
  scheduled workflows after 60 days of repository inactivity — which would
  silently kill both jobs on an app that stops receiving commits.

**Untested:** the backup restore path has never been exercised, and
`BACKUP_PASSPHRASE` is a write-only GitHub secret. If nobody has the passphrase
written down elsewhere, the backups cannot be decrypted. Worth a dry run.

## On demo day (when Baltaru is OK with the app)

### Step 1 — Forward Gmail to his real address

In `batusboxing@gmail.com` → Settings → Forwarding and POP/IMAP:
- Add Baltaru's real email as a forwarding address.
- He confirms via a verification email.
- Set "Forward a copy of incoming mail to [his address] and keep Gmail's copy in the Inbox."

He'll see all billing/security alerts in his normal inbox without ever logging into Gmail.

### Step 2 — Hand him the Gmail password

In `batusboxing@gmail.com` → Manage your Google Account → Security → Password.
- Pick a new password (or have him pick one).
- Tell him what it is. Recommend a password manager.
- Update the recovery phone and recovery email to his info.

That single password change IS the handover. Every service is owned by this Gmail. He now controls them all.

### Step 3 — His credit card on file

For each service that may charge him eventually (only matters past free-tier):
- Cloudflare → Manage Account → Billing → add his card.
- Supabase → Project Settings → Billing → add his card.
- Vercel → Settings → Billing → add his card (this is what renews the domain).

Free tiers don't charge cards, but having a card on file means a usage spike doesn't take the studio offline. The Netlify pause in August 2026 happened exactly this way: a free-tier limit changed, and the site went down the same morning.

### Step 4 — A second admin account

Right now there is exactly **one** admin login (`batusboxing@gmail.com`). If it
is locked out, nobody can approve a student or open the booking window. Create
a second admin (Supabase → Table editor → `profiles` → set `is_admin = true`)
for whoever else should be able to get in.

### Step 5 — Document recovery

Send him a one-page text with:
- App URL: https://batusboxe.com
- Admin login: his email at the app's `/login`.
- Status pages: cloudflarestatus.com, status.supabase.com.
- "If something breaks: check those two status pages first; if they're fine, the code is at github.com/DNunes8/batus and any Next.js developer can debug it."
- The Gmail password (if he didn't pick it himself).

That's it. You're out.

## What could ping you in 2 years (and how it's mitigated)

| Risk | Mitigation in place |
|---|---|
| Domain expires | His card autopays Vercel (~May 2027) |
| Hosting bill or a free-tier rule change | Free tiers cover the studio's traffic; card on file. This has already forced two migrations — budget an afternoon if it happens again |
| Database loss | Weekly encrypted GitHub Actions backup — **restore never tested** |
| Code stops working (Node EOL, security advisory) | Pinned Node 22 in `.nvmrc` + locked dep versions. Realistic worst case: every ~18mo someone bumps deps for 1–2 hours. The public repo means any Next.js dev can be hired to do it. |
| Booking window lapses | The admin dashboard warns three days out and once it's closed, with the button in the banner |

## If Diogo wants to fully cut ties

- Remove yourself from the Cloudflare account (Manage Account → Members).
- Remove yourself as a Supabase project member (Project Settings → Members).
- (Optional) Transfer the GitHub repo to a Baltaru-owned account, or leave it public on yours — either works since the code's already public. Note the two scheduled jobs and their secrets live on the repo, so they move with it.

The Gmail and the credit cards on file are the only "ownership" markers that matter operationally. Once those are his, the app is his.
