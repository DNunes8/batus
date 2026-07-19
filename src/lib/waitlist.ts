import { createAdminClient } from "@/lib/supabase/admin";
import { formatDayHeader, formatTime } from "@/lib/schedule";
import { sendWaitlistPromotionEmail, getSiteUrl } from "@/lib/email";

// Promote the first waitlisted student of a class instance — but ONLY if a
// seat is genuinely free: booked bookings + coach-added guests < effective
// capacity. Called from every seat-freeing path (student cancel, coach guest
// removal) so the waitlist drains fairly and nobody is promoted into a room
// the coach deliberately overfilled.
//
// Best-effort by design: any failure is logged and swallowed — the caller's
// flow (a cancel, a guest removal) must never break because of promotion.
export async function promoteFirstWaitlistedIfSeatFree(
  template_id: string,
  instance_date: string,
): Promise<void> {
  const admin = createAdminClient();
  try {
    const [templateRes, overrideRes, bookedRes, guestRes, nextRes] =
      await Promise.all([
        admin
          .from("class_templates")
          .select("name, start_time, capacity")
          .eq("id", template_id)
          .maybeSingle(),
        admin
          .from("class_overrides")
          .select("cancelled, override_capacity, override_start_time")
          .eq("template_id", template_id)
          .eq("instance_date", instance_date)
          .maybeSingle(),
        admin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("template_id", template_id)
          .eq("instance_date", instance_date)
          .eq("status", "booked"),
        admin
          .from("class_guests")
          .select("id", { count: "exact", head: true })
          .eq("template_id", template_id)
          .eq("instance_date", instance_date),
        admin
          .from("bookings")
          .select("id, user_id")
          .eq("template_id", template_id)
          .eq("instance_date", instance_date)
          .eq("status", "waitlisted")
          .order("waitlist_position", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

    const template = templateRes.data;
    const override = overrideRes.data;
    const nextInLine = nextRes.data;
    if (!template || !nextInLine) return;
    // Cancelled instance — nothing to promote into.
    if (override?.cancelled) return;

    const capacity = override?.override_capacity ?? template.capacity;
    const seats = (bookedRes.count ?? 0) + (guestRes.count ?? 0);
    // Still full (e.g. the coach overfilled past capacity) — leave the
    // waitlist untouched until a real seat opens.
    if (seats >= capacity) return;

    await admin
      .from("bookings")
      .update({ status: "booked", waitlist_position: null })
      .eq("id", nextInLine.id);

    // Tell the promoted student — they won't be refreshing the app.
    const { data: promoted } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", nextInLine.user_id)
      .maybeSingle();

    if (promoted?.email) {
      await sendWaitlistPromotionEmail({
        to: promoted.email,
        studentName: promoted.full_name,
        className: template.name,
        dateLabel: formatDayHeader(instance_date),
        timeLabel: formatTime(override?.override_start_time ?? template.start_time),
        siteUrl: getSiteUrl(),
      });
    }
  } catch (err) {
    console.error("[waitlist] promotion failed:", err);
  }
}
