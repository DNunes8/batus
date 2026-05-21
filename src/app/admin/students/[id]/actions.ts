"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth-guard";
import { parseEuroToCents } from "@/lib/money";
import { parseBirthdayFromForm } from "@/lib/birthday";

export async function updateStudentNotesAndGoals(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const goals = ((formData.get("goals") as string | null) ?? "").trim() || null;
  const full_name = ((formData.get("full_name") as string | null) ?? "").trim() ||
    null;
  const phone = ((formData.get("phone") as string | null) ?? "").trim() || null;
  const birthday = parseBirthdayFromForm(formData);

  // Per-student monthly fee override. Empty input → fall back to studio default.
  const feeRaw = ((formData.get("monthly_fee") as string | null) ?? "").trim();
  const monthly_fee_cents = feeRaw === "" ? null : parseEuroToCents(feeRaw);

  // Which Pagamentos tab this student belongs to + whether their monthly
  // payment is tracked (relevant for PT students who pay per-session).
  const service_type =
    ((formData.get("service_type") as string | null) ?? "group") === "solo"
      ? "solo"
      : "group";
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
      service_type,
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
