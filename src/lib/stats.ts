import { createClient } from "@/lib/supabase/server";
import {
  getStartTimeOverrides,
  lisbonInstant,
  todayLisbon,
} from "@/lib/schedule";

export type UpcomingBooking = {
  id: string;
  instance_date: string;
  status: "booked" | "waitlisted";
  template_name: string;
  start_time: string;
  duration_minutes: number;
};

export type StudentStats = {
  attended_this_month: number;
  total_attended: number;
  upcoming: UpcomingBooking[];
  cancelled: number;
};

type RawBooking = {
  id: string;
  instance_date: string;
  template_id: string;
  status: string;
  class_templates: {
    name: string;
    start_time: string;
    duration_minutes: number;
  };
};

export async function getStudentStats(userId: string): Promise<StudentStats> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select(
      `id, instance_date, template_id, status,
       class_templates!inner(name, start_time, duration_minutes)`,
    )
    .eq("user_id", userId)
    .order("instance_date", { ascending: false });

  const bookings = (data ?? []) as unknown as RawBooking[];
  const today = todayLisbon();
  const monthStart = today.slice(0, 7) + "-01";
  const now = Date.now();

  // A class the coach moved with "Adiar" keeps its old hour on the template.
  // Resolve the real time so /perfil shows when she should actually turn up,
  // so the cancellation cutoff is measured from the right moment, and so the
  // "already finished?" test below uses the hour she was actually told.
  // Only today's classes need the clock — anything earlier has certainly
  // finished, anything later certainly has not — so this asks about today and
  // the handful of upcoming days, not the student's whole history.
  const overrides = await getStartTimeOverrides(
    bookings
      .filter((b) => b.instance_date >= today)
      .map((b) => ({
        template_id: b.template_id,
        instance_date: b.instance_date,
      })),
  );

  const startTimeOf = (b: RawBooking) =>
    overrides.get(`${b.template_id}|${b.instance_date}`) ??
    b.class_templates.start_time;

  // "Done" means the class actually ended, not that its date arrived. Counting
  // by date alone credited a class at midnight and then took it back if the
  // student cancelled that afternoon — on a card whose whole promise is that
  // the number only goes up. It also left this morning's finished class
  // sitting under "Próximas" all day.
  const hasFinished = (b: RawBooking) => {
    if (b.instance_date < today) return true;
    if (b.instance_date > today) return false;
    return (
      lisbonInstant(b.instance_date, startTimeOf(b)).getTime() +
        b.class_templates.duration_minutes * 60_000 <=
      now
    );
  };

  const attendedThisMonth = bookings.filter(
    (b) =>
      b.instance_date >= monthStart &&
      hasFinished(b) &&
      (b.status === "attended" || b.status === "booked"),
  ).length;

  const totalAttended = bookings.filter(
    (b) => hasFinished(b) && (b.status === "attended" || b.status === "booked"),
  ).length;

  const upcomingRaw = bookings
    .filter(
      (b) =>
        !hasFinished(b) &&
        (b.status === "booked" || b.status === "waitlisted"),
    )
    .reverse()
    .slice(0, 10);

  const upcoming: UpcomingBooking[] = upcomingRaw.map((b) => ({
    id: b.id,
    instance_date: b.instance_date,
    status: b.status as "booked" | "waitlisted",
    template_name: b.class_templates.name,
    start_time: startTimeOf(b),
    duration_minutes: b.class_templates.duration_minutes,
  }));

  const cancelled = bookings.filter((b) => b.status === "cancelled").length;

  return {
    attended_this_month: attendedThisMonth,
    total_attended: totalAttended,
    upcoming,
    cancelled,
  };
}
