# Demo script — Batus walk-through with Baltaru

A 10-minute path through the app. Have these tabs ready:

1. https://batus-mu.vercel.app/ (public, incognito window helps for the "as a student" view)
2. https://batus-mu.vercel.app/admin (logged in as you)
3. (optional) Supabase dashboard — Table Editor — to show data is real

---

## 1. Public site (2 min)

**Open https://batus-mu.vercel.app/**

- Hero: BATUS wordmark + Boxing & Training + Braga · Portugal.
- Coach section: brief intro to Baltaru (placeholder text — he provides real bio).
- Horário semanal: live preview of class templates pulled from the database.
- CTAs: "Ver horário" → /aulas, "Contactar" → /contacto.

**Click "Ver horário" → /aulas**
- Weekly schedule grouped by day.
- Prev / Hoje / Next week navigation.
- Each class shows time, name, capacity (booked/total).
- "Entrar para marcar" CTA (since incognito = not logged in).

**Click "Contacto"**
- Contact form. Submit a test message — it lands in `/admin/messages`.

---

## 2. Student flow (2 min)

**In your normal browser window (logged in as Diogo / admin):**

Show the booking flow:
- /aulas → click "Marcar" on a class.
- Page reloads, button now reads "Marcado" with a "Cancelar" option.
- Click cancel — slot opens up. (If someone was on the waitlist, they get auto-promoted to booked.)

What students see vs. admins: students see only the count ("8/12") for privacy. Admins see the full roster (names) on `/admin/calendar`.

---

## 3. Admin flow (5 min)

**/admin** — dashboard (currently a placeholder welcome — Baltaru's daily-driver metrics go here when we know what he wants to see).

**/admin/calendar** — the main daily-use screen for him:
- Same week view as public, but with rosters under each class.
- "Fechar dia" form per day → upserts a closed_day, students see grey banner with reason.
- "Cancelar aula" form per class instance → cancels just that occurrence, students see "Cancelada".
- Reopen / Restaurar undoes either.
- Note: closing a day cascades to public schedule immediately.

**/admin/classes (Modelos)** — recurring class templates:
- Table of all weekly classes.
- "Nova aula" → form (name, day, time, duration, capacity, active dates).

**/admin/students (Alunos)** — registered users:
- Table with name, email, phone, joined date.
- Click a student → detail page:
  - Edit name, phone, **goals**, **private notes** (admin-only — your student CRM).
  - Payment ledger per month with "Marcar pago" toggle.
  - Add a new month of payment with amount + paid status.

**/admin/sessions (1:1s)** — solo sessions Baltaru manages directly:
- Table of past + future 1:1s.
- "Nova sessão" → form. Student input is fuzzy: matches existing accounts by email or name; if no match, stores as off-app name.
- These feed the earnings dashboard alongside member payments.

**/admin/earnings (Receitas)** — the feature he wanted that Regybox does poorly:
- This-month total + 6-month total.
- Split between mensalidades (member payments) and 1:1s.
- Simple bar chart of monthly trend.
- Counts only paid payment_records + all solo_sessions.

**/admin/messages (Mensagens)** — contact form inbox:
- Unread highlighted with "Nova" badge.
- Mark read/unread, delete.

---

## 4. Things intentionally not built (TALK list)

See [TALK_LIST.md](./TALK_LIST.md). These are decisions that need Baltaru's input before we build them:
- Free / trial class rules
- No-show policy
- Real bio + photos + logo file
- Color choice (gold currently — confirm or switch to red)
- Domain choice (batusboxing.pt vs batusboxe.pt)
- Existing student migration from Regybox
- Liability waiver text
- Privacy policy

---

## 5. Hand-off mechanics (1 min)

- All infrastructure is owned by `batusboxing@gmail.com`. Hand him that Gmail's password and he owns Vercel + Supabase + (future domain).
- Source code: public on github.com/DNunes8/batus. He doesn't need GitHub access to use the app.
- Cost today: €0/month (Vercel free + Supabase free). Domain when bought: ~€15/year.
- See [HANDOVER.md](./HANDOVER.md) for the full transfer steps.
