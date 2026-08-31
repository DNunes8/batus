import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, lisbonInstant, todayLisbon } from "@/lib/schedule";

// How late a student may cancel a confirmed booking, in hours before the class
// starts. Stored in settings so the coach can change it from /admin/classes
// without a deploy. Default matches the seeded value.
export const DEFAULT_CANCELLATION_CUTOFF_HOURS = 4;

export async function getCancellationCutoffHours(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("settings")
    .select("value")
    .eq("key", "cancellation_cutoff_hours")
    .maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CANCELLATION_CUTOFF_HOURS;
}

// THE cancellation predicate — used by BOTH the /perfil UI and the
// cancelBooking action. Keeping one source of truth is the point: when the UI
// decided independently, it offered a Cancelar button the server then refused,
// which is exactly how a student got stuck. Waitlisted bookings are always
// cancellable (they hold no seat).
export function canCancelBooking(args: {
  instance_date: string;
  start_time: string;
  status: string;
  cutoffHours: number;
  now?: number;
}): boolean {
  if (args.status !== "booked") return true;
  const startMs = lisbonInstant(args.instance_date, args.start_time).getTime();
  const cutoffMs = startMs - args.cutoffHours * 60 * 60 * 1000;
  return (args.now ?? Date.now()) <= cutoffMs;
}

// How far ahead "Abrir próximas 2 semanas" opens booking.
export const BOOKING_WINDOW_DAYS = 14;

// The last date (YYYY-MM-DD) students may book up to. The coach opens it with
// the "Abrir próximas 2 semanas" button (stored in settings.bookable_until).
// Until it's ever set, the window is closed beyond today — so the button has
// to be used to open the first fortnight.
export async function getBookableUntil(): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("settings")
    .select("value")
    .eq("key", "bookable_until")
    .maybeSingle();
  const raw = data?.value;
  return typeof raw === "string" ? raw : todayLisbon();
}

// The date the button would open to from today.
export function nextWindowEnd(today = todayLisbon()): string {
  return addDays(today, BOOKING_WINDOW_DAYS);
}
