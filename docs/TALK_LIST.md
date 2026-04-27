# TALK list — open questions for Baltaru

These are decisions intentionally deferred. The app works without them; Baltaru's answers shape the right implementation.

## Branding & content

- [ ] **Logo file** — we're using a screenshot of the Instagram logo. He has the proper SVG/PNG file?
- [ ] **Bio text for /sobre** — currently a placeholder. Need 2–3 paragraphs in his voice.
- [ ] **Studio address, email, phone** — placeholders in `studio.config.ts` and the footer.
- [ ] **Photos for the landing** — Instagram videos he mentioned (originals from photographer, not Insta-compressed).
- [ ] **Color choice** — gold accent (current) or Portuguese red. Look at the deploy and pick.
- [ ] **Domain** — `batusboxing.pt` (matches the Gmail) or `batusboxe.pt` or other. Buy once decided.

## Configuration

- [ ] **Cancellation cutoff** — currently 4h. Should it be 2h? 12h? 24h?
- [ ] **Class roster privacy** — students currently see only count ("8/12"), not other students' names. Confirm that's right?
- [ ] **Pricing display** — currently no public pricing. Show it on the site or "contact for pricing"?
- [ ] **Default class capacity** — default is 12. Per-class today, or one global number?

## Free / trial classes

- [ ] How does the "first class free" rule work today?
- [ ] Should it auto-grant a one-time free booking on signup? Or stays manual (Baltaru waives payment)?
- [ ] Other free-class scenarios — referrals, promotions?

## No-show policy

- [ ] What happens if a student doesn't cancel and doesn't show?
- [ ] Strike system? Auto-block after N? Manual flag?
- [ ] Should the system warn students who book and don't show?

## Migration & data

- [ ] **Existing student list** — want it imported from Regybox? CSV would do. Or fresh start.
- [ ] **Existing schedule** — what classes does he run today? (Currently: empty unless we seeded.)
- [ ] **Existing pricing** — monthly amount per modality, drop-in price.

## Legal

- [ ] **Liability waiver text** — checkbox at signup ("understand the risks of contact sport"). His exact wording.
- [ ] **Privacy policy** — GDPR. Need his legal name, contact email, data retention preferences.
- [ ] **Studio insurance details** — if relevant to display.

## Phase 2 (build only if he asks)

- [ ] **Merch store** — claim-and-pay-in-person, no payments, no shipping. Stock count + email-on-claim.
- [ ] **Student stats** — attendance count, streaks, total since joining.
- [ ] **WhatsApp/SMS notifications** — currently email-only. Useful for waitlist promotion?
- [ ] **Class packs** — 10-class bundles with their own pricing.
- [ ] **PWA polish** — manifest + icons (needs real logo), home-screen install.

## Operational

- [ ] **Email sender** — currently using Supabase's default email service (rate-limited 4/h). Once we have a domain, set up Resend SMTP for production-grade sending.
- [ ] **Backups** — Supabase free tier doesn't include automated daily DB backups. Set up a weekly cron dump to Supabase Storage before serious production use.
- [ ] **Custom domain in Vercel** — once bought, point DNS to Vercel + add to Supabase Site URL + redirect URLs.
