import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReminderBatch, getSiteUrl } from "@/lib/email";
import { currentMonthLabel, PAYMENT_CUTOFF_DAY } from "@/lib/payment";
import { todayLisbon } from "@/lib/schedule";

// Resend free tier allows 100 emails/day — cap a single run below that so the
// reminder burst can never exhaust the daily quota (welcome/waitlist emails
// share it). If the unpaid list is ever longer, the rest are skipped and
// logged; the coach chases stragglers in person anyway.
const DAILY_EMAIL_BUDGET = 90;

export const dynamic = "force-dynamic";

// Monthly payment reminder. Triggered by the GitHub Actions cron on the 8th
// (see .github/workflows/payment-reminders.yml). Emails every student who is
// currently blocked for non-payment — using the SAME rules as the booking
// gate (src/lib/payment.ts), so paused / paid / per-session / admin /
// first-month students are never emailed.
//
// Protected by CRON_SECRET (Vercel env + GitHub secret). Without it, 401.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = todayLisbon();
  // Safety: never send during the grace days, even if triggered manually.
  if (Number(today.slice(8, 10)) < PAYMENT_CUTOFF_DAY) {
    return NextResponse.json({ sent: 0, reason: "before cutoff" });
  }

  const admin = createAdminClient();
  const thisMonth = today.slice(0, 7); // YYYY-MM
  const monthStart = `${thisMonth}-01`;

  // Candidates: approved, non-admin, monthly-fee, joined before this month
  // (first-month grace). Mirrors isUnpaidAndBlocked's exemptions.
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, email, full_name, has_monthly_fee, joined_at")
    .eq("approved", true)
    .eq("is_admin", false);
  if (profilesError) {
    // Fail loudly (red run in GitHub Actions) — proceeding on a failed query
    // would compute a wrong recipient list.
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const candidates = (profiles ?? []).filter(
    (p) =>
      !!p.email &&
      p.has_monthly_fee !== false &&
      (p.joined_at ?? thisMonth).slice(0, 7) < thisMonth,
  );

  if (candidates.length === 0) {
    return NextResponse.json({ sent: 0, candidates: 0 });
  }

  // This month's payment status for the candidates; paid/paused are exempt.
  const { data: records, error: recordsError } = await admin
    .from("payment_records")
    .select("user_id, status")
    .eq("month", monthStart)
    .in(
      "user_id",
      candidates.map((c) => c.id),
    );
  if (recordsError) {
    // Without payment statuses, "unpaid" would wrongly include every PAID
    // student — abort instead of emailing up to 90 people who already paid.
    return NextResponse.json({ error: recordsError.message }, { status: 500 });
  }
  const statusByUser = new Map(
    (records ?? []).map((r) => [r.user_id, r.status]),
  );

  const unpaid = candidates.filter((c) => {
    const status = statusByUser.get(c.id) ?? null;
    return status !== "paid" && status !== "paused";
  });

  const siteUrl = getSiteUrl();
  const monthLabel = currentMonthLabel(today);

  // One batch request (max 100/call at Resend; we stay under the daily quota).
  // Sequential per-student sends would also trip Netlify's ~10s function
  // timeout once the list grows — the batch call is a single round-trip.
  const toSend = unpaid.slice(0, DAILY_EMAIL_BUDGET);
  const skipped = unpaid.length - toSend.length;
  if (skipped > 0) {
    console.warn(
      `[cron] payment-reminders: ${unpaid.length} unpaid, sending ${toSend.length}, skipping ${skipped} (daily email budget)`,
    );
  }

  const sent = await sendPaymentReminderBatch(
    toSend.map((u) => ({ to: u.email as string, studentName: u.full_name })),
    monthLabel,
    siteUrl,
  );

  // Batch send is best-effort internally, but a zero result with a non-empty
  // list means the whole call failed (or keys are unset) — surface it as a
  // red run instead of a silent green "sent: 0".
  if (toSend.length > 0 && sent === 0) {
    return NextResponse.json(
      { error: "batch send failed or email not configured", attempted: toSend.length },
      { status: 500 },
    );
  }

  return NextResponse.json({ sent, skipped, candidates: candidates.length });
}
