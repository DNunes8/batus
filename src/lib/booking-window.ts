import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, todayLisbon } from "@/lib/schedule";

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
