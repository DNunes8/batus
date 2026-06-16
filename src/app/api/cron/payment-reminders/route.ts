import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReminderEmail, getSiteUrl } from "@/lib/email";
import { currentMonthLabel, PAYMENT_CUTOFF_DAY } from "@/lib/payment";
import { todayLisbon } from "@/lib/schedule";

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
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, has_monthly_fee, joined_at")
    .eq("approved", true)
    .eq("is_admin", false);

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
  const { data: records } = await admin
    .from("payment_records")
    .select("user_id, status")
    .eq("month", monthStart)
    .in(
      "user_id",
      candidates.map((c) => c.id),
    );
  const statusByUser = new Map(
    (records ?? []).map((r) => [r.user_id, r.status]),
  );

  const unpaid = candidates.filter((c) => {
    const status = statusByUser.get(c.id) ?? null;
    return status !== "paid" && status !== "paused";
  });

  const siteUrl = getSiteUrl();
  const monthLabel = currentMonthLabel(today);

  let sent = 0;
  for (const u of unpaid) {
    await sendPaymentReminderEmail({
      to: u.email as string,
      studentName: u.full_name,
      monthLabel,
      siteUrl,
    });
    sent++;
  }

  return NextResponse.json({ sent, candidates: candidates.length });
}
