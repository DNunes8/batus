// Preflight — read-only health check against the live database.
//
// Run it before a deploy and again after. It does not test code paths; it
// asserts things that should NEVER be true of the data, which is where every
// expensive bug in this app has shown up: money recorded that nobody chose,
// seats stranded in a state no screen can reach, a booking window that lapsed.
//
//   npm run preflight
//
// Exit code 0 = every invariant holds. 1 = something needs looking at.
// It writes nothing, ever.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    // fall through to process.env
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (missing.length) {
    console.error(
      `preflight needs ${missing.join(" and ")} in .env.local (Supabase → Project Settings → API).\n` +
        "It reads the database directly, so unlike a deploy it cannot use the Cloudflare secrets.",
    );
    process.exit(2);
  }
  return createClient(url, key);
}

const todayLisbon = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());

const dow = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

// Two kinds of result. `check` is a hard invariant — if it fails, data is
// wrong and the exit code says so. `advise` is an operational note: true today,
// worth acting on, but not a reason to block a deploy.
const results = [];
const notes = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });
const advise = (name, ok, detail) => notes.push({ name, ok, detail });

// ---------------------------------------------------------------------------

const db = loadEnv();
const today = todayLisbon();

// PostgREST caps a plain select at 1000 rows and says so with a 206, which
// supabase-js reports as success — so an unbounded read on a growing table
// would quietly return a slice and every "no bad row exists" check below would
// pass by looking at less than the whole table. bookings crosses 1000 within a
// couple of weeks. Page explicitly instead.
async function readAll(table, columns, orderBy = "id") {
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    // OFFSET paging without ORDER BY has no stable row order in Postgres, so
    // pages could repeat or skip rows. Every table here has an ordered key.
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order(orderBy)
      .range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return { data: rows, error: null };
  }
}

const [
  settings,
  payments,
  bookings,
  overrides,
  closedDays,
  templates,
  profiles,
  guests,
] = await Promise.all([
  readAll("settings", "key, value", "key"),
  readAll("payment_records", "id, user_id, month, status, amount_cents"),
  readAll(
    "bookings",
    "id, user_id, template_id, instance_date, status, cancelled_reason",
  ),
  readAll("class_overrides", "template_id, instance_date, cancelled", "template_id"),
  readAll("closed_days", "date", "date"),
  readAll(
    "class_templates",
    "id, name, day_of_week, capacity, active_from, active_until",
  ),
  readAll(
    "profiles",
    "id, full_name, class_credits, monthly_fee_cents, is_admin, approved",
  ),
  // Coach-added guests hold real seats — every other surface counts them, so a
  // waitlist check that ignores them calls a full class half-empty.
  readAll("class_guests", "id, template_id, instance_date"),
]);

for (const [label, res] of Object.entries({
  settings, payments, bookings, overrides, closedDays, templates, profiles, guests,
})) {
  if (res.error) {
    console.error(`Could not read ${label}: ${res.error.message}`);
    process.exit(2);
  }
}

const setting = (k) => settings.data.find((s) => s.key === k)?.value;
const closed = new Set(closedDays.data.map((d) => d.date));
const tplById = new Map(templates.data.map((t) => [t.id, t]));
const cancelledInstances = new Set(
  overrides.data.filter((o) => o.cancelled).map((o) => `${o.template_id}|${o.instance_date}`),
);
const active = bookings.data.filter((b) => b.status === "booked" || b.status === "waitlisted");

// --- money ------------------------------------------------------------------

// A paid month worth 0,00 € contributes nothing to Finanças while reading as
// settled. The bulk action used to write these for students with no fee.
const paidAtZero = payments.data.filter((p) => p.status === "paid" && p.amount_cents === 0);
check(
  "no month is recorded as paid for 0,00 €",
  paidAtZero.length === 0,
  paidAtZero.map((p) => `${p.month} user=${p.user_id}`).join(", "),
);

const badMonth = payments.data.filter((p) => !/^\d{4}-\d{2}-01$/.test(p.month));
check("every payment row is keyed to the 1st of a month", badMonth.length === 0,
  badMonth.map((p) => p.month).join(", "));

const negativeCredits = profiles.data.filter((p) => (p.class_credits ?? 0) < 0);
check("no pack balance is negative", negativeCredits.length === 0,
  negativeCredits.map((p) => `${p.full_name}=${p.class_credits}`).join(", "));

// A pack student pays per bundle; a monthly fee on the same profile means two
// contradictory plans, and currentPlan() will call them a pack either way.
const packAndMonthly = profiles.data.filter(
  (p) => p.class_credits != null && p.monthly_fee_cents != null,
);
check("nobody is on a pack and a monthly fee at once", packAndMonthly.length === 0,
  packAndMonthly.map((p) => p.full_name).join(", "));

// --- stranded state ---------------------------------------------------------

// A coach-cancel marker survives only until the class is restored. One left on
// a class that is neither cancelled nor on a closed day means a restore died
// partway: the seat is gone and no screen can bring it back.
const MARKER = "BATUS_CLASS_CANCELLED:";
const stranded = bookings.data.filter(
  (b) =>
    b.status === "cancelled" &&
    (b.cancelled_reason ?? "").startsWith(MARKER) &&
    !cancelledInstances.has(`${b.template_id}|${b.instance_date}`) &&
    !closed.has(b.instance_date),
);
check(
  "no cancelled booking is marked for a restore that can no longer happen",
  stranded.length === 0,
  stranded.map((b) => `${b.instance_date} user=${b.user_id}`).join(", "),
);

// A seat on a closed day is invisible on every screen and unremovable.
const onClosedDay = active.filter((b) => closed.has(b.instance_date));
check("no active booking sits on a closed day", onClosedDay.length === 0,
  onClosedDay.map((b) => `${b.instance_date} user=${b.user_id}`).join(", "));

const onCancelled = active.filter((b) =>
  cancelledInstances.has(`${b.template_id}|${b.instance_date}`),
);
check("no active booking sits on a cancelled class", onCancelled.length === 0,
  onCancelled.map((b) => `${b.instance_date} user=${b.user_id}`).join(", "));

// Editing a template's weekday or end date orphans bookings onto a day the
// class no longer runs.
const orphaned = active.filter((b) => {
  const t = tplById.get(b.template_id);
  if (!t) return true;
  if (dow(b.instance_date) !== t.day_of_week) return true;
  if (b.instance_date < t.active_from) return true;
  if (t.active_until && b.instance_date > t.active_until) return true;
  return false;
});
check(
  "every active booking lands on a day its class actually runs",
  orphaned.length === 0,
  orphaned
    .map((b) => `${b.instance_date} ${tplById.get(b.template_id)?.name ?? "template gone"}`)
    .join(", "),
);

const seen = new Set();
const duplicates = [];
for (const b of active) {
  const k = `${b.user_id}|${b.template_id}|${b.instance_date}`;
  if (seen.has(k)) duplicates.push(k);
  seen.add(k);
}
check("nobody holds two active bookings for the same class", duplicates.length === 0,
  duplicates.join(", "));

// --- waitlist ---------------------------------------------------------------

// Someone waiting while a seat is free means a promotion was missed.
const byInstance = new Map();
for (const b of active) {
  const k = `${b.template_id}|${b.instance_date}`;
  const g = byInstance.get(k) ?? { booked: 0, waiting: 0 };
  if (b.status === "booked") g.booked++;
  else g.waiting++;
  byInstance.set(k, g);
}
for (const g of guests.data) {
  const k = `${g.template_id}|${g.instance_date}`;
  const e = byInstance.get(k) ?? { booked: 0, waiting: 0 };
  e.booked++;
  byInstance.set(k, e);
}
const stuckWaitlist = [];
for (const [k, g] of byInstance) {
  if (g.waiting === 0) continue;
  const [tid, date] = k.split("|");
  if (date < today) continue; // past classes are history, not a problem
  const cap = tplById.get(tid)?.capacity ?? 0;
  if (g.booked < cap) stuckWaitlist.push(`${date} ${tplById.get(tid)?.name} ${g.booked}/${cap} +${g.waiting} em espera`);
}
check("nobody is on a waitlist for a class with a free seat", stuckWaitlist.length === 0,
  stuckWaitlist.join(", "));

// --- operational ------------------------------------------------------------

const bookableUntil = setting("bookable_until");
advise(
  "the booking window is still open",
  typeof bookableUntil === "string" && bookableUntil >= today,
  `bookable_until = ${bookableUntil ?? "unset"}, hoje = ${today}`,
);

const cutoff = Number(setting("cancellation_cutoff_hours"));
check(
  "the cancellation cutoff is one of the values the admin page offers",
  [0.5, 1, 2, 4].includes(cutoff),
  `cancellation_cutoff_hours = ${setting("cancellation_cutoff_hours")}`,
);

const admins = profiles.data.filter((p) => p.is_admin);
advise(
  "there is more than one admin account",
  admins.length > 1,
  `${admins.length} admin: ${admins.map((a) => a.full_name ?? a.id).join(", ")}`,
);

// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "  ok  " : "  FAIL"}  ${r.name}`);
  if (!r.ok && r.detail) console.log(`        ${r.detail}`);
}
console.log(
  `\n${results.length - failed.length}/${results.length} invariants hold.` +
    (failed.length ? ` ${failed.length} NEED LOOKING AT.` : ""),
);

const unmet = notes.filter((n) => !n.ok);
if (unmet.length) {
  console.log("\nWorth knowing (not a reason to hold a deploy):");
  for (const n of unmet) {
    console.log(`  · not true right now: ${n.name}`);
    if (n.detail) console.log(`      ${n.detail}`);
  }
}

process.exit(failed.length ? 1 : 0);
