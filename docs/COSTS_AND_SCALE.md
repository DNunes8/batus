# Costs and scaling — what Baltaru pays now and at growth

Honest breakdown so you (Diogo) know what you're handing over and Baltaru knows what he's taking on. Numbers reflect Vercel and Supabase pricing as of May 2026.

## Today (and at 100 students)

| Item | Cost | Notes |
|---|---|---|
| Vercel Hobby | **€0/month** | Hosting, deploys, SSL — all included |
| Supabase Free | **€0/month** | DB, auth, storage |
| Resend Free | **€0/month** | 3,000 emails/month — enough |
| Domain (`.pt`) | ~€15/year | Buy once, autopays |
| **Total** | **€15/year** | About **€1.25/month** |

Compare to Regybox: ~€60/month → **€720/year saved.**

## Free-tier headroom

The numbers below are what's *included* in each free tier. The right column is what 100 active students realistically generate per month.

| Resource | Free-tier limit | 100 students consume | Headroom |
|---|---|---|---|
| Vercel bandwidth | 100 GB/month | ~2–4 GB | ~25× |
| Vercel function invocations | 100k/day | ~3–5k/day | ~25× |
| Supabase database size | 500 MB | ~5–10 MB | ~50× |
| Supabase MAU | 50,000 | 100 | ~500× |
| Supabase bandwidth | 5 GB/month | ~500 MB | ~10× |
| Resend emails | 3,000/month | ~500 | ~6× |

**You can ~5× the studio (to ~500 students) before hitting any paid tier.** That's a long runway.

## What forces a paid tier (when it happens)

These are the actual triggers, in order of likely-to-hit-first:

1. **Resend free tier (3k emails/month)** — magic-link logins + future booking confirmations + waitlist promotion notifications. Each active student probably triggers 2–4 emails/month. So **~750 active students** is when this becomes the bottleneck. Resend Pro is **€15/month** for 50k emails.

2. **Supabase free tier database (500 MB)** — current schema + 1 year of bookings is < 50 MB. To fill 500 MB he'd need ~10 years of operation at this scale, OR start storing photos/files in the DB (which he isn't). Supabase Pro is **€21/month** if it ever happens.

3. **Vercel Pro** — only if traffic grows hugely (10× current). Probably never with one studio. **€18/month** if needed.

4. **Daily database backups** — Supabase free tier doesn't include automated backups. The optional weekly cron-to-Storage I noted in the README is enough for a small studio. If the data ever feels mission-critical, Supabase Pro includes daily backups. **€21/month** as above.

## Email scaling — the one thing to pay attention to early

Right now, magic-link emails go via **Supabase's default email service**, which is rate-limited to **4 emails per hour, per email address**. That's fine while you're testing — not fine when 30 students all try to log in at the door before class.

**Set up Resend SMTP in Supabase Auth as soon as the studio has its own domain.** This raises the limit from 4/hour to 3,000/month total (Resend free tier).

Steps:
1. Buy `batusboxing.pt` (or whatever name).
2. Verify the domain in Resend (DNS records — Vercel makes this easy).
3. In Supabase: **Authentication → SMTP Settings** → paste Resend SMTP credentials.
4. Done. Emails now go via `noreply@batusboxing.pt` and the rate limit relaxes.

**Without this step, the app silently breaks for users when more than 4 try to log in within an hour.** It's the single highest-priority post-handover task.

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
- Higher request volume (Vercel Pro, never going to need it).

## TL;DR for the demo

> "Until your studio doubles in size, this costs €15/year. After that, expect it to be €15–195/year depending on volume. Anything more than that means you're a regional chain, congratulations."
