# Batus

Booking and management web app for **Batus Studio** — boxing and kickboxing in Braga, Portugal.

Replaces a third-party booking SaaS with a single, owner-controlled site that combines marketing, class booking, and admin tools.

Live at **https://batusboxe.com**.

## Stack

- **Next.js 16** (App Router) on **Cloudflare Workers**, via `@opennextjs/cloudflare`
- **Supabase** — Postgres, Auth, Storage
- **Tailwind v4** + **shadcn/ui**
- **Resend** for transactional email
- PWA (installable on iOS/Android home screen, no native app)

Everything runs on free tiers. See `docs/COSTS_AND_SCALE.md`.

## Local development

```bash
nvm use            # picks the version in .nvmrc (Node 22)
npm install
cp .env.example .env.local   # then fill it in — see below
npm run dev        # http://localhost:3000
```

## Environment variables

`.env.example` lists all of them and says where each one lives.

Short version: the two `NEXT_PUBLIC_*` values are compiled into the browser
bundle, so the machine that builds needs them. The rest are Cloudflare
secrets, read at runtime:

```bash
npx wrangler secret list
```

## Deploying

Deploys are manual and take about a minute:

```bash
npm run deploy
```

That builds **and** uploads. Do not run `opennextjs-cloudflare deploy` on its
own — it does not rebuild, so it will happily ship whatever is already in
`.open-next/` (this shipped a stale bundle once).

Before deploying:

```bash
npm run check      # types and a production build
npm run preflight  # read-only invariant check against the live database
```

`preflight` is the one that catches the bugs that actually cost money. It never
writes anything — it asserts things that should never be true of the data (a
month recorded as paid for 0,00 €, a seat stranded on a closed day, a booking
on a day its class no longer runs, someone waiting for a class with a free
seat) and exits non-zero if any of them are. Run it again after deploying.

`npm run lint` is separate and currently reports four React-hooks findings in
older dialogs (`login`, `add-class-dialog`, `payment-drawer`, `contacto`). They
are real lint rules, not build failures — worth a careful pass with the app
open in a browser, which is why they are not folded into `check`.

## Database changes

Migrations in `supabase/migrations/` are applied **by hand** in the Supabase
SQL editor, not by a CLI. Apply the SQL first, confirm it worked, then deploy
the code that depends on it.

## Architecture notes

- **Single source of branding:** `src/lib/studio.config.ts`. Logos, colors, contact info, copy live there.
- **`src/middleware.ts` must stay on the legacy middleware convention.** Next 16's `proxy.ts` is locked to the Node runtime, which the Cloudflare adapter cannot run; `middleware.ts` builds as edge.
- **Times are Lisbon wall-clock.** Class times are stored as the hour on the studio wall; `src/lib/schedule.ts` converts to real instants with the correct DST offset. The Worker's own clock is UTC — never use the local timezone for class logic.
- **Portuguese-first.**
- **No payments integration.** Cash / MBWay / bank transfer happen outside the app; admin tracks "paid this month" per student-month.

## Ownership

Infrastructure (Cloudflare, Supabase, Resend) is owned by
`batusboxing@gmail.com`. The domain is still **registered at Vercel** with its
nameservers pointed at Cloudflare — renewal is a Vercel bill. The GitHub repo
is public for resilience — anyone can clone if the original maintainer is
unreachable. See `docs/HANDOVER.md`.
