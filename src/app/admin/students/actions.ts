"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth-guard";
import { PLAN_CONFIG, type Plan } from "@/lib/plans";

// Approve a pending student so they can start booking classes.
// Called from the Alunos list and the student detail page.
export async function approveStudent(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ approved: true })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${id}`);
  revalidatePath("/admin");
}

// Approve + configure in one gesture: the dialog on the Alunos list asks which
// plan the new student is on, so the coach never has to remember a second step
// in Pagamentos. The standard fee is only PRE-FILLED when none is set yet —
// a custom fee the coach already typed is never overwritten.
// Returns { error } for expected failures instead of throwing — Next masks
// thrown messages in production, so the dialog would toast a generic English
// digest instead of the Portuguese reason (same pattern as commit 1d43536).
export async function approveStudentWithPlan(input: {
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
  if (readError) {
    // Without a trustworthy read we can't know whether a custom fee exists —
    // abort rather than risk overwriting one with the standard tier price.
    return { error: readError.message };
  }

  const update: Record<string, unknown> = {
    approved: true,
    service_type: config.service_type,
    weekly_class_limit: config.weekly_class_limit,
  };
  if (config.fee_cents !== null && current?.monthly_fee_cents == null) {
    update.monthly_fee_cents = config.fee_cents;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/pagamentos");
  revalidatePath("/aulas");
  return {};
}
