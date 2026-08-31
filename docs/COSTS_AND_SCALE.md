# Costs and scaling — what Baltaru pays now and at growth

Honest breakdown so you (Diogo) know what you're handing over and Baltaru knows what he's taking on. Numbers reflect Cloudflare, Supabase and Resend pricing as of August 2026.

**The app has moved hosts twice.** Vercel → Netlify (May 2026) → Cloudflare
Workers (August 2026). The Netlify move was forced with no warning when their
free plan changed and the site went down the same morning. Treat every
"free tier" line below as a snapshot, not a promise: the studio's real
protection is that the whole app is a standard Next.js repo that redeploys
somewhere else in an afternoon.

## Today (and at 100 students)

| Item | Cost | Notes |
|---|---|---|
| Cloudflare Workers Free | **€0/month** | Hosting, SSL, DNS — all included |
| Supabase Free | **€0/month** | DB, auth, storage |
| Resend Free | **€0/month** | 3,000 emails/month — enough |
| batusboxe.com | ~€15/year | Registered at Vercel, renews ~May 2027 |
| **Total** | **€15/year** | About **€1.25/month** |

Compare to Regybox: ~€60/month → **€720/year saved.**

## Free-tier headroom

The numbers below are what's *included* in each free tier. The right column is what 100 active students realistically generate per month.

| Resource | Free-tier limit | 100 students consume | Headroom |
|---|---|---|---|
| Cloudflare Workers requests | 100k/day | ~3–5k/day | ~25× |
| Cloudflare Workers CPU | 10 ms/request | well under | comfortable |
| Cloudflare subrequests | 50 per request | see note below | tight in places |
| Supabase database size | 500 MB | ~5–10 MB | ~50× |
| Supabase MAU | 50,000 | 100 | ~500× |
| Supabase bandwidth | 5 GB/month | ~500 MB | ~10× |
| Resend emails | 3,000/month | ~500 | ~6× |

**You can ~5× the studio (to ~500 students) before hitting any paid tier.** That's a long runway.

## What forces a paid tier (when it happens)

These are the actual triggers, in order of likely-to-hit-first:

1. **Resend free tier (3k emails/month)** — magic-link logins + future booking confirmations + waitlist promotion notifications. Each active student probably triggers 2–4 emails/month. So **~750 active students** is when this becomes the bottleneck. Resend Pro is **€15/month** for 50k emails.

2. **Supabase free tier database (500 MB)** — current schema + 1 year of bookings is < 50 MB. To fill 500 MB he'd need ~10 years of operation at this scale, OR start storing photos/files in the DB (which he isn't). Supabase Pro is **€21/month** if it ever happens.

3. **Cloudflare Workers Paid** — only if daily requests grow past 100k (10× current). Probably never with one studio. **$5/month** if needed. Note the *subrequest* limit bites before the request limit does: every Supabase query, RPC and email send inside one page or action counts, and 50 is the free-plan ceiling. Admin actions that touch every student on a day are written to work in batches for exactly this reason — keep them that way.

4. **Daily database backups** — Supabase free tier doesn't include automated backups. A weekly encrypted `pg_dump` runs as a GitHub Action (`.github/workflows/backup.yml`) and keeps 90 days of artifacts. **The restore path has never been tested, and BACKUP_PASSPHRASE is a write-only GitHub secret** — if nobody has it written down, the backups cannot be decrypted. If the data ever feels mission-critical, Supabase Pro includes daily backups. **€21/month** as above.

## Email scaling — the one thing to pay attention to early

This was the highest-priority task at handover time and it is **done**:
batusboxe.com is verified in Resend, and the app's own email (cancellations,
reschedules, coach-added confirmations) goes out from `noreply@batusboxe.com`
via the Resend API, in batches.

What is still worth checking one day: Supabase Auth's own transactional mail
(password reset, email confirmation) — if that still uses Supabase's default
sender it is rate-limited to **4 emails per hour per address**. Pointing
Supabase's **Authentication → SMTP Settings** at Resend removes that limit.

## At 6 months — likely scenarios

If Baltaru grows from 100 → 200 students:
- Still entirely on free tier.
- Email volume ~1,000/month → Resend free still fine.
- Cost: still ~€15/year.

If 200 → 500 students:
- Still free tier, but email volume creeps to ~2,500–3,000/month — close to the Resend free ceiling.
- Bump to Resend Pro (€15/month) at that point. Total: ~€195/year.

If 500 → 1,000 students:
- Likely Resend Pro + nothing else.
- Total: ~€195/year. Still 1/4 of Regybox.

If he becomes a multi-studio chain (genuinely unlikely for a boxing gym in Braga but mathematically):
- Supabase Pro at some point.
- ~€450/year all-in.

## What he's actually buying with that money

Not features — Regybox is bloated with features you'll never use. He's buying:
- Reliable email delivery (Resend Pro).
- Database backups (Supabase Pro, if he wants belt-and-suspenders).
- Higher request volume (Cloudflare Workers Paid, never going to need it).

## TL;DR for the demo

> "Until your studio doubles in size, this costs €15/year. After that, expect it to be €15–195/year depending on volume. Anything more than that means you're a regional chain, congratulations."
