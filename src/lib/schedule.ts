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
};

export type ScheduleDay = {
  date: string;
  day_of_week: number;
  closed: boolean;
  closed_reason?: string;
  classes: ScheduleClass[];
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
          .select("id, template_id, instance_date, status")
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
