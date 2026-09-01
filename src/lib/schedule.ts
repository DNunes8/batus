import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ScheduleClass = {
  template_id: string;
  date: string; // YYYY-MM-DD
  name: string;
  description: string | null;
  start_time: string; // HH:MM:SS
  duration_minutes: number;
  capacity: number;
  booked_count: number;
  waitlist_count: number;
  cancelled: boolean;
  cancellation_reason?: string;
  user_booking_id?: string;
  user_booking_status?: "booked" | "waitlisted";
  user_waitlist_position?: number | null;
};

export type ScheduleDay = {
  date: string;
  day_of_week: number;
  closed: boolean;
  closed_reason?: string;
  classes: ScheduleClass[];
};

export type RosterEntry = {
  booking_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  status: "booked" | "waitlisted";
  waitlist_position: number | null;
};

export type ClassGuest = {
  id: string;
  name: string;
};

export type AdminGroupEntry = ScheduleClass & {
  kind: "group";
  roster: RosterEntry[];
  // Coach-added people (aula experimental / manual placement). They occupy
  // seats — booked_count already includes them.
  guests: ClassGuest[];
};

export type AdminSoloEntry = {
  kind: "solo";
  template_id: string;
  date: string;
  user_id: string | null;
  student_name: string;
  start_time: string;
  duration_minutes: number;
  price_cents: number;
  notes: string | null;
  cancelled: boolean;
  cancellation_reason?: string;
};

export type AdminScheduleEntry = AdminGroupEntry | AdminSoloEntry;

// Backwards-compat alias for the calendar code that still calls these
// "classes". Both kinds now flow through this type.
export type AdminScheduleClass = AdminScheduleEntry;

export type AdminScheduleDay = Omit<ScheduleDay, "classes"> & {
  entries: AdminScheduleEntry[];
};

// ---------- date helpers ----------

export function todayLisbon(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
  }).format(new Date());
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return formatISODate(d);
}

export function dayOfWeek(s: string): number {
  return parseISODate(s).getUTCDay();
}

export function mondayOf(s: string): string {
  const dow = dayOfWeek(s);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(s, offset);
}

// Returns the input if it's a valid YYYY-MM-DD date, else today (Lisbon).
// Defends pages against ?week=garbage in the URL.
export function safeReferenceDate(input: string | undefined): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const d = new Date(`${input}T00:00:00Z`);
    if (!isNaN(d.getTime())) return input;
  }
  return todayLisbon();
}

// How far Lisbon wall-clock is ahead of UTC at a given instant, in ms.
// Asks Intl for the real zone rules rather than guessing, so it is exact on
// both sides of a DST switch (Portugal flips on the last Sunday of March and
// of October — a month-based guess is wrong for up to four weeks a year).
function lisbonOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Lisbon",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const p: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - instant.getTime();
}

// THE time primitive for this app. Class times are stored as Lisbon wall-clock
// ("18:00" means 6pm at the studio), but the server runs in UTC — so
// `new Date("2026-08-31T18:00:00")` silently means 19:00 Lisbon in summer.
// That one-hour lie is what let a student be refused a cancellation she was
// entitled to. Convert here, always, before comparing a class time to now().
export function lisbonInstant(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi, s] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0);
  // Subtract the offset that applies at that moment. The first guess can land
  // on the wrong side of a switch, so re-resolve once with the corrected
  // instant (standard two-pass wall-clock → UTC conversion).
  const first = naive - lisbonOffsetMs(new Date(naive));
  const second = naive - lisbonOffsetMs(new Date(first));
  return new Date(second);
}

// Server-side check: is this class instance already in the past?
export function isClassInPast(date: string, startTime: string): boolean {
  return lisbonInstant(date, startTime).getTime() < Date.now();
}

// When the coach uses "Adiar", the new time lives in class_overrides, NOT on
// the template — the template keeps its original hour forever. Every RENDER
// path already resolves the override; the gates that decide what a student or
// coach is ALLOWED to do were reading the template directly, so a rescheduled
// class was judged against an hour it no longer starts at.
//
// Resolve the real start time for a set of (template_id, instance_date) pairs
// in ONE query. Returns a lookup keyed "templateId|date"; anything missing
// simply has no override and keeps the template time.
export async function getStartTimeOverrides(
  pairs: { template_id: string; instance_date: string }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (pairs.length === 0) return out;

  const admin = createAdminClient();
  const dates = [...new Set(pairs.map((p) => p.instance_date))];
  const templateIds = [...new Set(pairs.map((p) => p.template_id))];
  const { data } = await admin
    .from("class_overrides")
    .select("template_id, instance_date, override_start_time")
    .in("instance_date", dates)
    .in("template_id", templateIds)
    .not("override_start_time", "is", null);

  for (const row of data ?? []) {
    out.set(
      `${row.template_id}|${row.instance_date}`,
      row.override_start_time as string,
    );
  }
  return out;
}

// Single-instance convenience wrapper for the action paths.
export async function effectiveStartTime(
  template_id: string,
  instance_date: string,
  templateStartTime: string,
): Promise<string> {
  const map = await getStartTimeOverrides([{ template_id, instance_date }]);
  return map.get(`${template_id}|${instance_date}`) ?? templateStartTime;
}

export type ResolvedInstance = {
  template_id: string;
  instance_date: string;
  name: string;
  start_time: string; // effective (override applied)
  duration_minutes: number;
  capacity: number; // effective (override applied)
};

export type InstanceProblem =
  | "notfound" // template id doesn't exist
  | "notonthisday" // template doesn't run on that weekday
  | "outofwindow" // date is outside the template's active_from/active_until
  | "cancelled" // this instance was cancelled by the coach
  | "closed" // the whole day is closed
  | "past"; // the class has already started

// Does this (template, date) pair name a class that REALLY EXISTS and can
// still be booked? The rendering side already answers this — it only draws
// instances that pass every one of these tests — but the write side used to
// take the ids from the form and trust them, so a page opened before the coach
// cancelled a class (or closed the day) could still book into it. One resolver,
// used by the write paths, so the two can't drift.
export async function resolveClassInstance(
  template_id: string,
  instance_date: string,
): Promise<
  { ok: true; instance: ResolvedInstance } | { ok: false; problem: InstanceProblem }
> {
  const admin = createAdminClient();

  const [templateRes, overrideRes, closedRes] = await Promise.all([
    admin
      .from("class_templates")
      .select(
        "id, name, day_of_week, start_time, duration_minutes, capacity, active_from, active_until",
      )
      .eq("id", template_id)
      .maybeSingle(),
    admin
      .from("class_overrides")
      .select("cancelled, override_start_time, override_capacity")
      .eq("template_id", template_id)
      .eq("instance_date", instance_date)
      .maybeSingle(),
    admin
      .from("closed_days")
      .select("date")
      .eq("date", instance_date)
      .maybeSingle(),
  ]);

  const t = templateRes.data;
  if (!t) return { ok: false, problem: "notfound" };
  if (closedRes.data) return { ok: false, problem: "closed" };
  if (overrideRes.data?.cancelled) return { ok: false, problem: "cancelled" };

  // The schedule only renders a template on its own weekday, inside its active
  // window — so a date that fails either test is not a real class.
  if (dayOfWeek(instance_date) !== t.day_of_week) {
    return { ok: false, problem: "notonthisday" };
  }
  if (
    instance_date < (t.active_from as string) ||
    (t.active_until && instance_date > (t.active_until as string))
  ) {
    return { ok: false, problem: "outofwindow" };
  }

  const start_time =
    (overrideRes.data?.override_start_time as string | null) ??
    (t.start_time as string);
  if (isClassInPast(instance_date, start_time)) {
    return { ok: false, problem: "past" };
  }

  return {
    ok: true,
    instance: {
      template_id,
      instance_date,
      name: t.name as string,
      start_time,
      duration_minutes: t.duration_minutes as number,
      capacity:
        (overrideRes.data?.override_capacity as number | null) ??
        (t.capacity as number),
    },
  };
}

const PT_DAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const PT_MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function formatDayHeader(s: string): string {
  const d = parseISODate(s);
  return `${PT_DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${PT_MONTHS[d.getUTCMonth()]}`;
}

export function formatWeekRange(start: string): string {
  const startD = parseISODate(start);
  const end = parseISODate(addDays(start, 6));
  if (startD.getUTCMonth() === end.getUTCMonth()) {
    return `${startD.getUTCDate()}–${end.getUTCDate()} ${PT_MONTHS[startD.getUTCMonth()]}`;
  }
  return `${startD.getUTCDate()} ${PT_MONTHS[startD.getUTCMonth()]} – ${end.getUTCDate()} ${PT_MONTHS[end.getUTCMonth()]}`;
}

export function formatTime(t: string): string {
  // "18:00:00" -> "18:00"
  return t.slice(0, 5);
}

// ---------- data ----------

export async function getWeekSchedule(
  weekStart: string,
): Promise<ScheduleDay[]> {
  const weekEnd = addDays(weekStart, 7); // exclusive

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    templatesRes,
    overridesRes,
    closedDaysRes,
    bookingCountsRes,
    guestCountsRes,
  ] = await Promise.all([
    supabase.from("class_templates").select("*"),
    supabase
      .from("class_overrides")
      .select("*")
      .gte("instance_date", weekStart)
      .lt("instance_date", weekEnd),
    supabase
      .from("closed_days")
      .select("*")
      .gte("date", weekStart)
      .lt("date", weekEnd),
    admin
      .from("bookings")
      .select("template_id, instance_date, status")
      .gte("instance_date", weekStart)
      .lt("instance_date", weekEnd)
      .in("status", ["booked", "waitlisted"]),
    // Coach-added guests occupy seats too (admin client: table is coach-only).
    admin
      .from("class_guests")
      .select("template_id, instance_date")
      .gte("instance_date", weekStart)
      .lt("instance_date", weekEnd),
  ]);

  const templates = templatesRes.data ?? [];
  const overrides = overridesRes.data ?? [];
  const closedDays = closedDaysRes.data ?? [];
  const bookingCounts = bookingCountsRes.data ?? [];
  const guestCounts = guestCountsRes.data ?? [];

  const userBookings = user
    ? (
        await supabase
          .from("bookings")
          .select("id, template_id, instance_date, status, waitlist_position")
          .eq("user_id", user.id)
          .gte("instance_date", weekStart)
          .lt("instance_date", weekEnd)
          .neq("status", "cancelled")
      ).data ?? []
    : [];

  const days: ScheduleDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dow = dayOfWeek(date);

    const closedDay = closedDays.find((c) => c.date === date);
    if (closedDay) {
      days.push({
        date,
        day_of_week: dow,
        closed: true,
        closed_reason: closedDay.reason,
        classes: [],
      });
      continue;
    }

    const dayTemplates = templates.filter(
      (t) =>
        t.day_of_week === dow &&
        t.active_from <= date &&
        (t.active_until === null || t.active_until >= date),
    );

    const classes: ScheduleClass[] = dayTemplates.map((t) => {
      const override = overrides.find(
        (o) => o.template_id === t.id && o.instance_date === date,
      );

      if (override?.cancelled) {
        return {
          template_id: t.id,
          date,
          name: t.name,
          description: t.description,
          start_time: t.start_time,
          duration_minutes: t.duration_minutes,
          capacity: t.capacity,
          booked_count: 0,
          waitlist_count: 0,
          cancelled: true,
          cancellation_reason: override.reason ?? undefined,
        };
      }

      const startTime = override?.override_start_time ?? t.start_time;
      const capacity = override?.override_capacity ?? t.capacity;
      const duration = override?.override_duration_minutes ?? t.duration_minutes;

      const matching = bookingCounts.filter(
        (b) => b.template_id === t.id && b.instance_date === date,
      );
      const guestSeats = guestCounts.filter(
        (g) => g.template_id === t.id && g.instance_date === date,
      ).length;
      const booked_count =
        matching.filter((b) => b.status === "booked").length + guestSeats;
      const waitlist_count = matching.filter(
        (b) => b.status === "waitlisted",
      ).length;

      const userBooking = userBookings.find(
        (ub) => ub.template_id === t.id && ub.instance_date === date,
      );

      return {
        template_id: t.id,
        date,
        name: t.name,
        description: t.description,
        start_time: startTime,
        duration_minutes: duration,
        capacity,
        booked_count,
        waitlist_count,
        cancelled: false,
        user_booking_id: userBooking?.id,
        user_booking_status:
          userBooking?.status === "booked" || userBooking?.status === "waitlisted"
            ? userBooking.status
            : undefined,
        user_waitlist_position: userBooking?.waitlist_position ?? null,
      };
    });

    classes.sort((a, b) => a.start_time.localeCompare(b.start_time));

    days.push({
      date,
      day_of_week: dow,
      closed: false,
      classes,
    });
  }

  return days;
}

// Admin variant: uses service-role client so it can see all bookings + profiles.
// Returns merged group-class + PT entries per day, sorted by start_time.
export async function getAdminWeekSchedule(
  weekStart: string,
): Promise<AdminScheduleDay[]> {
  const weekEnd = addDays(weekStart, 7);
  const admin = createAdminClient();

  const [
    classTemplatesRes,
    classOverridesRes,
    closedDaysRes,
    bookingsRes,
    soloTemplatesRes,
    soloOverridesRes,
    guestsRes,
  ] = await Promise.all([
    admin.from("class_templates").select("*"),
    admin
      .from("class_overrides")
      .select("*")
      .gte("instance_date", weekStart)
      .lt("instance_date", weekEnd),
    admin
      .from("closed_days")
      .select("*")
      .gte("date", weekStart)
      .lt("date", weekEnd),
    admin
      .from("bookings")
      .select(
        `id, template_id, instance_date, status, waitlist_position, booked_at, profile:profiles(id, email, full_name)`,
      )
      .gte("instance_date", weekStart)
      .lt("instance_date", weekEnd)
      .in("status", ["booked", "waitlisted"]),
    admin
      .from("solo_session_templates")
      .select(
        `id, user_id, student_name, day_of_week, start_time, duration_minutes, price_cents, notes, active_from, active_until, is_preset, profile:profiles(full_name)`,
      ),
    admin
      .from("solo_session_overrides")
      .select("*")
      .gte("instance_date", weekStart)
      .lt("instance_date", weekEnd),
    admin
      .from("class_guests")
      .select("id, template_id, instance_date, name")
      .gte("instance_date", weekStart)
      .lt("instance_date", weekEnd)
      .order("created_at", { ascending: true }),
  ]);

  const classTemplates = classTemplatesRes.data ?? [];
  const classOverrides = classOverridesRes.data ?? [];
  const closedDays = closedDaysRes.data ?? [];
  const bookings = bookingsRes.data ?? [];
  const soloTemplates = soloTemplatesRes.data ?? [];
  const soloOverrides = soloOverridesRes.data ?? [];
  const allGuests = guestsRes.data ?? [];

  const days: AdminScheduleDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dow = dayOfWeek(date);

    const closedDay = closedDays.find((c) => c.date === date);
    if (closedDay) {
      days.push({
        date,
        day_of_week: dow,
        closed: true,
        closed_reason: closedDay.reason,
        entries: [],
      });
      continue;
    }

    // ---------- group class instances ----------
    const dayClassTemplates = classTemplates.filter(
      (t) =>
        t.day_of_week === dow &&
        t.active_from <= date &&
        (t.active_until === null || t.active_until >= date),
    );

    const groupEntries: AdminGroupEntry[] = dayClassTemplates.map((t) => {
      const override = classOverrides.find(
        (o) => o.template_id === t.id && o.instance_date === date,
      );

      const matching = bookings.filter(
        (b) => b.template_id === t.id && b.instance_date === date,
      );

      const guests: ClassGuest[] = allGuests
        .filter((g) => g.template_id === t.id && g.instance_date === date)
        .map((g) => ({ id: g.id, name: g.name }));

      const roster: RosterEntry[] = matching.map((b) => {
        const profile = b.profile as unknown as {
          id: string;
          email: string;
          full_name: string | null;
        };
        return {
          booking_id: b.id,
          user_id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          status: b.status as "booked" | "waitlisted",
          waitlist_position: b.waitlist_position,
        };
      });

      roster.sort((a, b) => {
        if (a.status === "booked" && b.status !== "booked") return -1;
        if (a.status !== "booked" && b.status === "booked") return 1;
        return (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0);
      });

      if (override?.cancelled) {
        return {
          kind: "group" as const,
          template_id: t.id,
          date,
          name: t.name,
          description: t.description,
          start_time: t.start_time,
          duration_minutes: t.duration_minutes,
          capacity: t.capacity,
          booked_count: 0,
          waitlist_count: 0,
          cancelled: true,
          cancellation_reason: override.reason ?? undefined,
          roster,
          guests,
        };
      }

      const booked_count =
        roster.filter((r) => r.status === "booked").length + guests.length;
      const waitlist_count = roster.filter(
        (r) => r.status === "waitlisted",
      ).length;

      return {
        kind: "group" as const,
        template_id: t.id,
        date,
        name: t.name,
        description: t.description,
        start_time: override?.override_start_time ?? t.start_time,
        duration_minutes:
          override?.override_duration_minutes ?? t.duration_minutes,
        capacity: override?.override_capacity ?? t.capacity,
        booked_count,
        waitlist_count,
        cancelled: false,
        roster,
        guests,
      };
    });

    // ---------- PT instances ----------
    // Presets are reusable models, not real sessions — they never render.
    const daySoloTemplates = soloTemplates.filter(
      (t) =>
        !t.is_preset &&
        t.day_of_week === dow &&
        t.active_from <= date &&
        (t.active_until === null || t.active_until >= date),
    );

    const soloEntries: AdminSoloEntry[] = daySoloTemplates.map((t) => {
      const override = soloOverrides.find(
        (o) => o.template_id === t.id && o.instance_date === date,
      );

      const profile = t.profile as unknown as {
        full_name: string | null;
      } | null;
      const student = profile?.full_name || t.student_name || "Aluno";

      if (override?.cancelled) {
        return {
          kind: "solo" as const,
          template_id: t.id,
          date,
          user_id: t.user_id,
          student_name: student,
          start_time: t.start_time,
          duration_minutes: t.duration_minutes,
          price_cents: t.price_cents,
          notes: t.notes,
          cancelled: true,
          cancellation_reason: override.reason ?? undefined,
        };
      }

      return {
        kind: "solo" as const,
        template_id: t.id,
        date,
        user_id: t.user_id,
        student_name: student,
        start_time: override?.override_start_time ?? t.start_time,
        duration_minutes:
          override?.override_duration_minutes ?? t.duration_minutes,
        price_cents: t.price_cents,
        notes: t.notes,
        cancelled: false,
      };
    });

    // ---------- merge + sort by start_time ----------
    const entries: AdminScheduleEntry[] = [...groupEntries, ...soloEntries];
    entries.sort((a, b) => a.start_time.localeCompare(b.start_time));

    days.push({
      date,
      day_of_week: dow,
      closed: false,
      entries,
    });
  }

  return days;
}
