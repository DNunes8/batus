# Hand-off guide

Single-purpose doc: how to transfer Batus from Diogo's hands to Baltaru's, cleanly and permanently.

## What Baltaru ends up owning

| Service | Account | What it does |
|---|---|---|
| Vercel | `batusboxing@gmail.com` | Hosts the app (free tier) |
| Supabase | `batusboxing@gmail.com` | Database, auth, storage (free tier) |
| Resend (when added) | `batusboxing@gmail.com` | Transactional email (free tier 3k/mo) |
| Domain registrar | `batusboxing@gmail.com` | Domain ownership and renewal |
| Gmail (`batusboxing@gmail.com`) | Baltaru | The umbrella account billing alerts arrive at |

Source code lives at `github.com/DNunes8/batus` (public). Baltaru does NOT need a GitHub account to run the app — only if he ever hires a developer to extend it.

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

That single password change IS the handover. Every service we set up (Vercel, Supabase, etc.) is owned by this Gmail. He now controls them all.

### Step 3 — His credit card on file

For each service that may charge him eventually (only matters past free-tier):
- Vercel → Settings → Billing → add his card.
- Supabase → Project Settings → Billing → add his card.
- Domain registrar → Account → Billing → add his card.

Free tiers don't charge cards, but having a card on file means a usage spike doesn't take the studio offline.

### Step 4 — Document recovery

Send him a one-page text with:
- App URL: https://batus-mu.vercel.app/ (and the custom domain when bought).
- Admin login: his email at the app's `/login`.
- Status pages: status.vercel.com, status.supabase.com.
- "If something breaks: try Vercel and Supabase status first; if it's fine, the code is at github.com/DNunes8/batus and any Next.js developer can debug in an hour."
- The Gmail password (if he didn't pick it himself).

That's it. You're out.

## What could ping you in 2 years (and how it's mitigated)

| Risk | Mitigation in place |
|---|---|
| Domain expires | His card autopays the registrar |
| Hosting bill | Free tiers cover the studio's traffic; his card on file if exceeded |
| Database loss | Supabase's nightly snapshots (paid plans) — for free tier, set up a weekly cron dumping to Storage before production use |
| Code stops working (Node EOL, security advisory) | Pinned Node 22 in `.nvmrc` + locked dep versions. Realistic worst case: every ~18mo someone bumps deps for 1–2 hours. The public repo means any Next.js dev can be hired off the street to do it. |
| Email rate limit | Default Supabase mail (4/h) is fine pre-launch. Set up Resend SMTP once a domain is configured. |

## If Diogo wants to fully cut ties

- Remove yourself as Vercel team member (Settings → Members).
- Remove yourself as Supabase project member (Project Settings → Members).
- (Optional) Transfer the GitHub repo to a Baltaru-owned GitHub account, or leave it public on yours — either works since the code's already public.

The Gmail and the credit cards on file are the only "ownership" markers that matter operationally. Once those are his, the app is his.
