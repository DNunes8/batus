"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";

export async function updateStudentNotesAndGoals(formData: FormData) {
  const id = formData.get("id") as string | null;
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const goals = ((formData.get("goals") as string | null) ?? "").trim() || null;
  const full_name = ((formData.get("full_name") as string | null) ?? "").trim() ||
    null;
  const phone = ((formData.get("phone") as string | null) ?? "").trim() || null;

  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ notes, goals, full_name, phone })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/students/${id}`);
}

export async function upsertPaymentRecord(formData: FormData) {
  const user_id = formData.get("user_id") as string | null;
  const month = formData.get("month") as string | null;
  const priceRaw = (formData.get("amount") as string | null) ?? "0";
  const amount_cents = parseEuroToCents(priceRaw);
  const paidChecked = formData.get("paid") === "on";
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;

  if (!user_id || !month) throw new Error("Dados em falta.");

  // month input is YYYY-MM; we store as YYYY-MM-01.
  const monthDate = month.length === 7 ? `${month}-01` : month;

  const supabase = await createClient();
  const { error } = await supabase.from("payment_records").upsert(
    {
      user_id,
      month: monthDate,
      amount_cents,
      paid_at: paidChecked ? new Date().toISOString() : null,
      notes,
    },
    { onConflict: "user_id,month" },
  );

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/students/${user_id}`);
  revalidatePath("/admin/earnings");
}

export async function togglePaymentStatus(formData: FormData) {
  const id = formData.get("id") as string | null;
  const user_id = formData.get("user_id") as string | null;
  const currentlyPaid = formData.get("currently_paid") === "true";

  if (!id || !user_id) throw new Error("Dados em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_records")
    .update({
      paid_at: currentlyPaid ? null : new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/students/${user_id}`);
  revalidatePath("/admin/earnings");
}
