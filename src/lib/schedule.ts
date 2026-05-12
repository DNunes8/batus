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

export type AdminGroupEntry = ScheduleClass & {
  kind: "group";
  roster: RosterEntry[];
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

// Server-side check: is this class instance already in the past?
// Approximates Lisbon offset (DST aware via month). Off by minutes during
// DST transition windows, fine for "should we show the Marcar button".
export function isClassInPast(date: string, startTime: string): boolean {
  const month = parseISODate(date).getUTCMonth();
  const offset = month >= 2 && month <= 9 ? "+01:00" : "+00:00";
  const start = new Date(`${date}T${startTime}${offset}`);
  return start.getTime() < Date.now();
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
  ]);

  const templates = templatesRes.data ?? [];
  const overrides = overridesRes.data ?? [];
  const closedDays = closedDaysRes.data ?? [];
  const bookingCounts = bookingCountsRes.data ?? [];

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
      const booked_count = matching.filter((b) => b.status === "booked").length;
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
// Returns merged group-class + 1:1 entries per day, sorted by start_time.
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
        `id, user_id, student_name, day_of_week, start_time, duration_minutes, price_cents, notes, active_from, active_until, profile:profiles(full_name)`,
      ),
    admin
      .from("solo_session_overrides")
      .select("*")
      .gte("instance_date", weekStart)
      .lt("instance_date", weekEnd),
  ]);

  const classTemplates = classTemplatesRes.data ?? [];
  const classOverrides = classOverridesRes.data ?? [];
  const closedDays = closedDaysRes.data ?? [];
  const bookings = bookingsRes.data ?? [];
  const soloTemplates = soloTemplatesRes.data ?? [];
  const soloOverrides = soloOverridesRes.data ?? [];

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
        };
      }

      const booked_count = roster.filter((r) => r.status === "booked").length;
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
      };
    });

    // ---------- 1:1 instances ----------
    const daySoloTemplates = soloTemplates.filter(
      (t) =>
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
