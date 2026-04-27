# Batus

Booking and management web app for **Batus Studio** — boxing and kickboxing in Braga, Portugal.

Replaces a third-party booking SaaS with a single, owner-controlled site that combines marketing, class booking, and admin tools.

## Stack

- **Next.js 16** (App Router) on **Vercel**
- **Supabase** — Postgres, Auth (magic link), Storage
- **Tailwind v4** + **shadcn/ui**
- **Resend** for transactional email
- PWA (installable on iOS/Android home screen, no native app)

## Local development

```bash
nvm use            # picks the version in .nvmrc (Node 22)
npm install
npm run dev        # http://localhost:3000
```

## Environment variables

See `.env.example` once added (Day 2 — Supabase setup).

## Architecture notes

- **Single source of branding:** `src/lib/studio.config.ts`. Logos, colors, contact info, copy live there.
- **Portuguese-first.** Optional EN later via a single `pt.json` / `en.json` swap.
- **No payments integration.** Cash / MBWay / bank transfer happen outside the app; admin tracks "paid this month" per student-month.

## Ownership

Infrastructure (Vercel, Supabase, future domain) is owned by `batusboxing@gmail.com`. The single GitHub repo is public for resilience — anyone can clone if the original maintainer is unreachable.
