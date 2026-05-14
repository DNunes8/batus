"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";

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
// month — only flips the status. For new rows, uses per-student fee override
// if set, otherwise the studio default.
// ----------------------------------------------------------------------------
export async function bulkSetPaymentStatus(input: {
  user_ids: string[];
  month: string;
  status: PaymentStatus;
}) {
  const { user_ids, month, status } = input;
  if (user_ids.length === 0) return { updated: 0 };
  if (!month) throw new Error("Mês em falta.");
  if (!["paid", "unpaid", "paused"].includes(status)) {
    throw new Error("Estado inválido.");
  }

  const supabase = await createClient();

  // Pull default fee + per-student overrides + existing records concurrently.
  const [settingRes, profilesRes, existingRes] = await Promise.all([
    supabase
      .from("settings")
      .select("value")
      .eq("key", "default_monthly_fee_cents")
      .single(),
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

  const defaultFee = Number(settingRes.data?.value ?? 0);

  const feeByStudent = new Map<string, number>();
  for (const p of profilesRes.data ?? []) {
    feeByStudent.set(p.id, p.monthly_fee_cents ?? defaultFee);
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
      amount_cents: existing?.amount_cents ?? feeByStudent.get(uid) ?? defaultFee,
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
// Set/clear the per-student monthly fee override (form action).
// Empty input → clears the override and student falls back to the studio default.
// ----------------------------------------------------------------------------
export async function setStudentMonthlyFee(formData: FormData) {
  const user_id = formData.get("user_id") as string | null;
  const raw = ((formData.get("amount") as string | null) ?? "").trim();
  if (!user_id) throw new Error("ID em falta.");

  const monthly_fee_cents = raw === "" ? null : parseEuroToCents(raw);

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
// Move a student between the "Aulas de grupo" and "1:1s" tabs.
// Just flips profiles.service_type — payment history is preserved either way.
// ----------------------------------------------------------------------------
export async function setStudentServiceType(input: {
  user_id: string;
  service_type: "group" | "solo";
}) {
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
// For a 1:1 student: opt them in/out of monthly payment tracking.
// false → "pays per session, cash on the day" — no payment_record needed.
// true  → "has a fixed monthly fee" — same Pago/Por pagar UX as mensalistas.
// ----------------------------------------------------------------------------
export async function setStudentHasMonthlyFee(input: {
  user_id: string;
  has_monthly_fee: boolean;
}) {
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

// ----------------------------------------------------------------------------
// Set the studio-wide default fee (form action). Stored in the settings table.
// ----------------------------------------------------------------------------
export async function setDefaultMonthlyFee(formData: FormData) {
  const raw = ((formData.get("amount") as string | null) ?? "").trim();
  const cents = parseEuroToCents(raw);

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "default_monthly_fee_cents", value: cents });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/pagamentos");
}
