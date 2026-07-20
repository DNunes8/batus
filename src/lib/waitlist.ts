import { createAdminClient } from "@/lib/supabase/admin";
import { formatDayHeader, formatTime } from "@/lib/schedule";
import { sendWaitlistPromotionEmail, getSiteUrl } from "@/lib/email";

// Promote the first waitlisted student of a class instance — but ONLY if a
// seat is genuinely free: booked bookings + coach-added guests < effective
// capacity. Called from every seat-freeing path (student cancel, coach guest
// removal) so the waitlist drains fairly and nobody is promoted into a room
// the coach deliberately overfilled.
//
// The promotion itself — re-count under lock, spend a pack candidate's credit,
// skip anyone who ran dry, flip exactly one row to booked — happens atomically
// inside the promote_waitlist RPC (advisory-locked on the SAME key as
// book_class), so two near-simultaneous seat-frees can't double-promote or
// double-spend a credit. Here we just resolve the effective capacity and, on
// success, email whoever got promoted.
//
// Best-effort by design: any failure is logged and swallowed — the caller's
// flow (a cancel, a guest removal) must never break because of promotion.
export async function promoteFirstWaitlistedIfSeatFree(
  template_id: string,
  instance_date: string,
): Promise<void> {
  const admin = createAdminClient();
  try {
    const [templateRes, overrideRes] = await Promise.all([
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
    ]);

    const template = templateRes.data;
    const override = overrideRes.data;
    if (!template) return;
    // Cancelled instance — nothing to promote into.
    if (override?.cancelled) return;

    const capacity = override?.override_capacity ?? template.capacity;

    // Atomic: locks the instance, re-checks the seat, spends a pack candidate's
    // credit and flips the first eligible waitlisted row to booked — all in one
    // transaction. Returns the promoted user_id, or null if nobody was promoted.
    const { data: promotedUserId, error: promoteError } = await admin.rpc(
      "promote_waitlist",
      {
        p_template_id: template_id,
        p_instance_date: instance_date,
        p_capacity: capacity,
      },
    );
    if (promoteError) {
      console.error("[waitlist] promote_waitlist failed:", promoteError);
      return;
    }
    if (!promotedUserId) return;

    // Tell the promoted student — they won't be refreshing the app.
    const { data: promoted } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", promotedUserId)
      .maybeSingle();

    if (promoted?.email) {
      await sendWaitlistPromotionEmail({
        to: promoted.email,
        studentName: promoted.full_name,
        className: template.name,
        dateLabel: formatDayHeader(instance_date),
        timeLabel: formatTime(
          override?.override_start_time ?? template.start_time,
        ),
        siteUrl: getSiteUrl(),
      });
    }
  } catch (err) {
    console.error("[waitlist] promotion failed:", err);
  }
}
