"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth-guard";

export type PaymentStatus = "paid" | "unpaid" | "paused";

// ----------------------------------------------------------------------------
// Single-student update from the drawer.
// Called as a regular async function (not a form action) from the client
// component so we can pass typed arguments instead of stringly-typed FormData.
// ----------------------------------------------------------------------------
export async function setPaymentStatus(input: {
  user_id: string;
  month: string; // YYYY-MM-01
  status: PaymentStatus;
  amount_cents: number;
  notes: string | null;
}) {
  await assertAdmin();
  const { user_id, month, status, amount_cents, notes } = input;
  if (!user_id || !month) throw new Error("Dados em falta.");
  if (!["paid", "unpaid", "paused"].includes(status)) {
    throw new Error("Estado inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payment_records").upsert(
    {
      user_id,
      month,
      status,
      amount_cents,
      paid_at: status === "paid" ? new Date().toISOString() : null,
      notes: notes && notes.trim() ? notes.trim() : null,
    },
    { onConflict: "user_id,month" },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/admin/pagamentos");
  revalidatePath(`/admin/students/${user_id}`);
}

// ----------------------------------------------------------------------------
// Bulk update from the selection bar.
// Preserves existing amount/notes for students who already have a row this
// month — only flips the status. For new rows, uses the student's standing
// monthly fee; if not set, falls back to 0 (coach can edit per-month after).
// ----------------------------------------------------------------------------
export async function bulkSetPaymentStatus(input: {
  user_ids: string[];
  month: string;
  status: PaymentStatus;
}) {
  await assertAdmin();
  const { user_ids, month, status } = input;
  if (user_ids.length === 0) return { updated: 0 };
  if (!month) throw new Error("Mês em falta.");
  if (!["paid", "unpaid", "paused"].includes(status)) {
    throw new Error("Estado inválido.");
  }

  const supabase = await createClient();

  const [profilesRes, existingRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, monthly_fee_cents")
      .in("id", user_ids),
    supabase
      .from("payment_records")
      .select("user_id, amount_cents, notes")
      .eq("month", month)
      .in("user_id", user_ids),
  ]);

  const feeByStudent = new Map<string, number>();
  for (const p of profilesRes.data ?? []) {
    feeByStudent.set(p.id, p.monthly_fee_cents ?? 0);
  }

  const existingByStudent = new Map<
    string,
    { amount_cents: number; notes: string | null }
  >();
  for (const r of existingRes.data ?? []) {
    existingByStudent.set(r.user_id, {
      amount_cents: r.amount_cents,
      notes: r.notes,
    });
  }

  const now = new Date().toISOString();
  const rows = user_ids.map((uid) => {
    const existing = existingByStudent.get(uid);
    // Preserve customised amount/notes for students who already have a row,
    // so flipping "unpaid → paid" doesn't wipe a custom price the coach set.
    return {
      user_id: uid,
      month,
      status,
      amount_cents: existing?.amount_cents ?? feeByStudent.get(uid) ?? 0,
      paid_at: status === "paid" ? now : null,
      notes: existing?.notes ?? null,
    };
  });

  const { error } = await supabase
    .from("payment_records")
    .upsert(rows, { onConflict: "user_id,month" });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/pagamentos");
  return { updated: rows.length };
}

// ----------------------------------------------------------------------------
// Set/clear the per-student standing monthly fee. Called from the drawer
// (typed args, not FormData). null → fee not yet defined, shows "Por definir".
// ----------------------------------------------------------------------------
export async function setStudentMonthlyFee(input: {
  user_id: string;
  monthly_fee_cents: number | null;
}) {
  await assertAdmin();
  const { user_id, monthly_fee_cents } = input;
  if (!user_id) throw new Error("ID em falta.");
  if (
    monthly_fee_cents !== null &&
    (!Number.isFinite(monthly_fee_cents) || monthly_fee_cents < 0)
  ) {
    throw new Error("Valor inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ monthly_fee_cents })
    .eq("id", user_id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/pagamentos");
  revalidatePath(`/admin/students/${user_id}`);
}

// ----------------------------------------------------------------------------
// Set the student's plan tier: how many group classes they may book per week
// (25€→1, 35€→2, 50€→3, 60€→null/livre). Enforced by book_class (0019).
// ----------------------------------------------------------------------------
export async function setStudentWeeklyLimit(input: {
  user_id: string;
  weekly_class_limit: number | null;
}) {
  await assertAdmin();
  const { user_id, weekly_class_limit } = input;
  if (!user_id) throw new Error("ID em falta.");
  if (
    weekly_class_limit !== null &&
    (!Number.isInteger(weekly_class_limit) ||
      weekly_class_limit < 1 ||
      weekly_class_limit > 7)
  ) {
    throw new Error("Limite inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ weekly_class_limit })
    .eq("id", user_id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/pagamentos");
  revalidatePath(`/admin/students/${user_id}`);
  revalidatePath("/aulas");
}

// ----------------------------------------------------------------------------
// Move a student between the "Aulas de grupo" and "PTs" tabs.
// Just flips profiles.service_type — payment history is preserved either way.
// ----------------------------------------------------------------------------
export async function setStudentServiceType(input: {
  user_id: string;
  service_type: "group" | "solo";
}) {
  await assertAdmin();
  const { user_id, service_type } = input;
  if (!user_id) throw new Error("ID em falta.");
  if (!["group", "solo"].includes(service_type)) {
    throw new Error("Tipo inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ service_type })
    .eq("id", user_id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/pagamentos");
  revalidatePath(`/admin/students/${user_id}`);
}

// ----------------------------------------------------------------------------
// For a PT student: opt them in/out of monthly payment tracking.
// false → "pays per session, cash on the day" — no payment_record needed.
// true  → "has a fixed monthly fee" — same Pago/Por pagar UX as mensalistas.
// ----------------------------------------------------------------------------
export async function setStudentHasMonthlyFee(input: {
  user_id: string;
  has_monthly_fee: boolean;
}) {
  await assertAdmin();
  const { user_id, has_monthly_fee } = input;
  if (!user_id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ has_monthly_fee })
    .eq("id", user_id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/pagamentos");
  revalidatePath(`/admin/students/${user_id}`);
}

