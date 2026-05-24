import { createAdminClient } from "@/lib/supabase/admin";
import { todayLisbon } from "@/lib/schedule";

// Payment gate: from this day of the month, a monthly student who hasn't paid
// the current month can't book. Days before it are a grace period. One number
// to change here (could become a Settings row later).
export const PAYMENT_CUTOFF_DAY = 8;

const PT_MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function currentMonthLabel(today = todayLisbon()): string {
  return PT_MONTHS[Number(today.slice(5, 7)) - 1];
}

type GateProfile = {
  is_admin?: boolean | null;
  has_monthly_fee?: boolean | null;
  joined_at?: string | null;
};

// True when this student should be blocked from booking for non-payment.
// Rules:
//   • admins + per-session (has_monthly_fee = false) students are exempt
//   • days 1 .. CUTOFF-1 are a grace period (never blocked)
//   • a student who joined this month gets their first month free of the gate
//   • this month's payment status of "paid" or "paused" (on a break) is fine;
//     anything else (unpaid / no record) is blocked once past the cutoff
export async function isUnpaidAndBlocked(
  userId: string,
  profile: GateProfile,
): Promise<boolean> {
  if (profile.is_admin) return false;
  if (profile.has_monthly_fee === false) return false;

  const today = todayLisbon();
  if (Number(today.slice(8, 10)) < PAYMENT_CUTOFF_DAY) return false;

  const thisMonth = today.slice(0, 7); // YYYY-MM
  const joinedMonth = (profile.joined_at ?? thisMonth).slice(0, 7);
  if (joinedMonth >= thisMonth) return false; // first-month grace

  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_records")
    .select("status")
    .eq("user_id", userId)
    .eq("month", `${thisMonth}-01`)
    .maybeSingle();

  const status = data?.status ?? null;
  return status !== "paid" && status !== "paused";
}
