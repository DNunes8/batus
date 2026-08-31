import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, lisbonInstant, todayLisbon } from "@/lib/schedule";

// How late a student may cancel a confirmed booking, in hours before the class
// starts. Stored in settings so the coach can change it from /admin/classes
// without a deploy. Default matches the seeded value.
export const DEFAULT_CANCELLATION_CUTOFF_HOURS = 4;

// The choices the coach can pick from. Deliberately a short list of taps
// rather than a free number box: he reads the option instead of translating a
// number into a rule, and a typo can't lock every student out. Fractional
// hours are allowed (0.5 = 30 minutes) — do not round these.
//
// No "à hora da aula" (0): cancelling as the class begins leaves nobody time
// to take the freed seat, so the shortest useful rule is 30 minutes.
export const CUTOFF_OPTIONS = [0.5, 1, 2, 4] as const;

export function cutoffLabel(hours: number): string {
  if (hours === 0) return "à hora da aula";
  if (hours < 1) return `${Math.round(hours * 60)} minutos antes`;
  return hours === 1 ? "1 hora antes" : `${hours} horas antes`;
}

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
