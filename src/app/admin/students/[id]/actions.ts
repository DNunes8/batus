"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth-guard";
import { parseEuroToCents } from "@/lib/money";
import { parseBirthdayFromForm } from "@/lib/birthday";
import { PLAN_CONFIG, STANDARD_FEES_CENTS, type Plan } from "@/lib/plans";

export async function updateStudentNotesAndGoals(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const goals = ((formData.get("goals") as string | null) ?? "").trim() || null;
  const full_name = ((formData.get("full_name") as string | null) ?? "").trim() ||
    null;
  const phone = ((formData.get("phone") as string | null) ?? "").trim() || null;
  const birthday = parseBirthdayFromForm(formData);

  // Per-student monthly fee override. Empty input → "Por definir". Normally set
  // by the plan (see setStudentPlan); the coach edits it here only for a custom
  // rate that differs from the tier price.
  const feeRaw = ((formData.get("monthly_fee") as string | null) ?? "").trim();
  const monthly_fee_cents = feeRaw === "" ? null : parseEuroToCents(feeRaw);

  // Whether this student's monthly payment is tracked (PTs who pay per-session
  // turn this off). service_type + weekly_class_limit are owned by the plan
  // card now, so they are intentionally not read or written here.
  const has_monthly_fee = formData.get("has_monthly_fee") === "on";

  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      notes,
      goals,
      full_name,
      phone,
      birthday,
      monthly_fee_cents,
      has_monthly_fee,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/students/${id}`);
  revalidatePath("/admin/pagamentos");
  redirect(`/admin/students/${id}?saved=1`);
}

// Pause or reactivate a student's account. A paused account can't book new
// classes — both the bookClass server action and the booking UI check
// is_blocked. Existing bookings are untouched: the student can still cancel
// those from /perfil. The protect_profile_columns trigger (migration 0003)
// lets admins write is_blocked, same as approveStudent writes `approved`.
export async function setStudentPaused(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  const paused = formData.get("paused") === "true";
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_blocked: paused })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/students/${id}`);
  revalidatePath("/admin/students");
  revalidatePath("/admin/pagamentos");
}

export async function upsertPaymentRecord(formData: FormData) {
  await assertAdmin();
  const user_id = formData.get("user_id") as string | null;
  const month = formData.get("month") as string | null;
  const priceRaw = (formData.get("amount") as string | null) ?? "0";
  const amount_cents = parseEuroToCents(priceRaw);
  const statusRaw = (formData.get("status") as string | null) ?? "unpaid";
  const status = ["paid", "unpaid", "paused"].includes(statusRaw)
    ? statusRaw
    : "unpaid";
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;

  if (!user_id || !month) throw new Error("Dados em falta.");

  const monthDate = month.length === 7 ? `${month}-01` : month;

  const supabase = await createClient();
  const { error } = await supabase.from("payment_records").upsert(
    {
      user_id,
      month: monthDate,
      amount_cents,
      status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
      notes,
    },
    { onConflict: "user_id,month" },
  );

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/students/${user_id}`);
  revalidatePath("/admin/pagamentos");
  redirect(`/admin/students/${user_id}?saved=1`);
}

// Toggle through paid → unpaid → paused → paid on a single row.
// Used by the legacy inline button on the student detail page so the coach
// can flip a payment status without opening the full editor.
export async function togglePaymentStatus(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  const user_id = formData.get("user_id") as string | null;
  const currentStatus = (formData.get("current_status") as string | null) ?? "unpaid";

  if (!id || !user_id) throw new Error("Dados em falta.");

  const next: "paid" | "unpaid" | "paused" =
    currentStatus === "paid"
      ? "unpaid"
      : currentStatus === "unpaid"
        ? "paused"
        : "paid";

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_records")
    .update({
      status: next,
      paid_at: next === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/students/${user_id}`);
  revalidatePath("/admin/pagamentos");
}

// Set an existing student's plan from the plan card. Unlike approval, this also
// SNAPS the monthly fee to the new tier's standard price — but only when the
// current fee is plan-derived (null, or one of the standard tier prices). A
// custom rate the coach set on purpose (any other value) is preserved. PT never
// sets a fee (those vary per student). Returns { error } for expected failures
// (Next masks thrown Server Action messages in production).
export async function setStudentPlan(input: {
  id: string;
  plan: Plan;
}): Promise<{ error?: string }> {
  await assertAdmin();
  const { id, plan } = input;
  if (!id) return { error: "ID em falta." };
  if (!Object.hasOwn(PLAN_CONFIG, plan)) return { error: "Plano inválido." };
  const config = PLAN_CONFIG[plan];

  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("monthly_fee_cents")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { error: readError.message };

  const update: Record<string, unknown> = {
    service_type: config.service_type,
    weekly_class_limit: config.weekly_class_limit,
  };

  // Fee follows the plan unless it's a custom (non-standard) rate.
  const cur = current?.monthly_fee_cents ?? null;
  const feeIsPlanDerived = cur === null || STANDARD_FEES_CENTS.has(cur);
  if (config.fee_cents !== null && feeIsPlanDerived) {
    update.monthly_fee_cents = config.fee_cents;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/students/${id}`);
  revalidatePath("/admin/students");
  revalidatePath("/admin/pagamentos");
  revalidatePath("/aulas");
  return {};
}
