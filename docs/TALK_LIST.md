# TALK list — open questions for Baltaru

_Updated 2026-05-18._ Decisions intentionally deferred — the app works without them. Baltaru's answers shape the right implementation.

## Branding & content

- [ ] **Logo file** — currently a square screenshot stand-in. Does he have the proper SVG/PNG? (The header logo and the PWA icons both need it.)
- [ ] **Bio & studio story for /sobre** — the page is a full editorial layout now, but the copy is placeholder written in his voice. Need his real words.
- [ ] **Studio address, email, phone** — still `TBD` in `studio.config.ts`; the footer and contact page hide them until they're set.
- [ ] **Photos & video** — real photographer originals for the landing page and the /sobre gallery/video slots (they drop into `studio.config.ts`).
- [ ] **Accent colour** — gold (current) or Portuguese red. Look at the live site and pick.
- [ ] **Domain** — `batusboxing.pt` (matches the Gmail) or `batusboxe.pt`. Buy once decided.

## Configuration

- [ ] **Cancellation cutoff** — currently 4h. 2h? 12h? 24h?
- [ ] **Account approval** — new students land pending and the coach approves each one from /admin/students. Keep that, or auto-approve on signup?
- [ ] **Class roster privacy** — students see only the count ("8/12"), not names. Confirm that's right.
- [ ] **Pricing display** — no public pricing today. Show it on the site, or keep "contact for pricing"?
- [ ] **Default class capacity** — currently 12.

## Free / trial classes

- [ ] How does the "first class free" rule work today?
- [ ] Auto-grant a one-time free booking on signup, or keep it manual (Baltaru just waives payment)?
- [ ] Other free-class scenarios — referrals, promotions?

## No-show policy

- [ ] What happens if a student doesn't cancel and doesn't show?
- [ ] Strike system, auto-block after N, or manual flag?

## Migration & data

- [ ] **Existing student list** — import from Regybox (a CSV would do), or fresh start?
- [ ] **Existing schedule** — confirm the class templates already loaded match what he actually runs.
- [ ] **Existing pricing** — monthly amount per modality, drop-in price.

## Legal

- [ ] **Data-controller details** — the Terms & Privacy pages are written and live, but need his legal name + NIF (the `legal` block in `studio.config.ts`) before public launch.
- [ ] **Liability waiver** — the Terms page covers the risks of a contact sport. Decide whether to also add an explicit "I understand the risks" checkbox at signup.
- [ ] **Studio insurance** — any details relevant to display?

## Merch store — content

The store itself is built (public /loja, admin /admin/merch + /admin/claims; claim-and-pay-in-person, stock count, email-on-claim). Open:

- [ ] Which items, prices and stock to load.
- [ ] Which email address should be notified when a student reserves an item.

## Future — build only if he asks

- [ ] **WhatsApp / SMS notifications** — currently email-only. Useful for waitlist promotion?
- [ ] **Class packs** — 10-class bundles with their own pricing.
- [ ] **PWA polish** — manifest + icons (needs the real logo) for home-screen install.

## Operational — before serious production use

- [ ] **Email sender** — currently Supabase's default service (rate-limited). Once there's a domain, set up Resend SMTP.
- [ ] **Backups** — the Supabase free tier has no automated daily DB backup. Set up a weekly dump.
- [ ] **Custom domain** — once bought, point DNS to Vercel and add it to Supabase's Site URL + redirect URLs.
