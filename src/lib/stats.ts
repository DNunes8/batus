import { createClient } from "@/lib/supabase/server";
import { todayLisbon } from "@/lib/schedule";

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
      `id, instance_date, status,
       class_templates!inner(name, start_time, duration_minutes)`,
    )
    .eq("user_id", userId)
    .order("instance_date", { ascending: false });

  const bookings = (data ?? []) as unknown as RawBooking[];
  const today = todayLisbon();
  const monthStart = today.slice(0, 7) + "-01";

  const attendedThisMonth = bookings.filter(
    (b) =>
      b.instance_date >= monthStart &&
      b.instance_date <= today &&
      (b.status === "attended" || b.status === "booked"),
  ).length;

  const totalAttended = bookings.filter(
    (b) =>
      b.instance_date <= today &&
      (b.status === "attended" || b.status === "booked"),
  ).length;

  const upcoming: UpcomingBooking[] = bookings
    .filter(
      (b) =>
        b.instance_date >= today &&
        (b.status === "booked" || b.status === "waitlisted"),
    )
    .reverse()
    .slice(0, 10)
    .map((b) => ({
      id: b.id,
      instance_date: b.instance_date,
      status: b.status as "booked" | "waitlisted",
      template_name: b.class_templates.name,
      start_time: b.class_templates.start_time,
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
