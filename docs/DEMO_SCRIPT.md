# Demo script — Batus walk-through with Baltaru

_Updated 2026-05-18._ A ~10-minute path through the app. Tabs to have ready:

1. https://batus-mu.vercel.app/ — the public site (an incognito window helps for the "as a student" view)
2. https://batus-mu.vercel.app/admin — logged in as you
3. (optional) Supabase dashboard → Table Editor — to show the data is real

---

## 1. Public site (2–3 min)

**Home — https://batus-mu.vercel.app/**
- Hero, manifesto band, coach section, a live weekly-schedule preview (pulled from the database), and a student testimonial.
- CTAs: "Ver horário" → /aulas, "Contactar" → /contacto.

**/sobre** — the About page: hero, the studio story, a Robert Baltaru bio, the modalities, and "para quem". The copy is placeholder written in his voice — he supplies the real bio.

**/aulas** — the weekly schedule, grouped by day, with prev / hoje / next navigation. Each class shows time, name and capacity (booked/total). Logged out, it shows an "Entrar para marcar" CTA.

**/loja** — the merch store. Items with a stock count; a student reserves online and pays in person on pickup — no online payments.

**/contacto** — contact form. Submit a test message; it lands in /admin/messages.

**/termos & /privacidade** — Terms and Privacy Policy, RGPD-aligned, linked in the footer.

---

## 2. Student flow (2 min)

**The approval gate — know this before you demo:** a brand-new signup lands *pending*. They can browse the site, but **cannot book a class until the coach approves them**. A pending student's /perfil shows an "A aguardar aprovação" panel instead of the booking tools.

→ For a smooth booking demo, use an account you've already approved. You can show the pending state and the approval step separately in the admin part.

With an approved account:
- /aulas → "Marcar" on a class → the button becomes "Marcado" with a "Cancelar" option.
- Cancel → the slot reopens; anyone on the waitlist is auto-promoted.
- /perfil — the student's own page: stats (aulas this month, total, upcoming classes), plus where they edit their details and set a password.

Privacy: students see only the count ("8/12"), never other students' names. Admins see the full roster on /admin/calendar.

---

## 3. Admin flow (5 min)

The admin area has its own layout — a sidebar on desktop, a top bar on mobile — marked with an "Admin" badge.

**/admin — Dashboard.** A real daily-driver screen:
- A banner when new accounts are waiting for approval.
- Four metric cards: receitas este mês, aulas hoje, pedidos pendentes, mensagens por ler.
- "Hoje" — today's classes with booked/capacity.
- Shortcuts: nova aula, nova sessão 1:1, ver alunos, novo artigo.

**/admin/calendar — Calendário** (his main daily screen):
- Week view, the same as the public one but with the roster under each class.
- "Fechar dia" → students see a grey banner with the reason.
- "Cancelar aula" → cancels a single occurrence. Reopen / Restaurar undoes either.

**/admin/classes — Modelos** — recurring class templates. "Nova aula" → form (name, day, time, duration, capacity, active dates).

**/admin/students — Alunos** — registered students.
- **Approve pending accounts here** — a new signup can't book until you do.
- Click a student → detail page: name, phone, goals, private notes (your CRM), payment ledger.

**/admin/sessions — 1:1s** — solo sessions Baltaru runs directly. "Nova sessão" matches an existing account by email/name, or stores an off-app name. These feed the earnings.

**/admin/pagamentos — Pagamentos** — payment tracking + earnings, the part Regybox does poorly:
- Two tabs — "Aulas de grupo" and "1:1s".
- A per-month board: each student's paid / por pagar / em pausa status, monthly fee, and a 6-month history strip.
- "Receitas dos últimos 6 meses" — a bar chart of member payments + 1:1 revenue, with the running total.

**/admin/messages — Mensagens** — the contact-form inbox. Unread highlighted; mark read/unread, delete.

**/admin/merch — Loja** — merch items and stock. "Novo artigo" to add one.
**/admin/claims — Pedidos** — the reservations students make from /loja; mark them fulfilled or cancelled.

---

## 4. Decisions for Baltaru

The app works today; these are the calls only he can make. Full list in [TALK_LIST.md](./TALK_LIST.md) — the headlines:

- Real logo file, photos, and his bio for /sobre
- Accent colour — gold (current) or Portuguese red
- Domain — batusboxing.pt vs batusboxe.pt
- Cancellation cutoff (currently 4h); public pricing yes/no
- Free / trial-class rules; no-show policy
- Importing the existing student list from Regybox
- His legal name + NIF to complete the Terms / Privacy pages

---

## 5. Hand-off mechanics (1 min)

- All infrastructure sits under `batusboxing@gmail.com` — hand him that Gmail's password and he owns Vercel + Supabase + (future domain).
- Source code: public on github.com/DNunes8/batus.
- Cost today: €0/month (Vercel free + Supabase free). Domain when bought: ~€15/year.
- See [HANDOVER.md](./HANDOVER.md) for the full transfer steps.
