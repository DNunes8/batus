"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";

export async function createSoloSession(formData: FormData) {
  const supabase = await createClient();

  const session_date = formData.get("session_date") as string | null;
  const duration_minutes = Number(formData.get("duration_minutes") ?? 60);
  const priceRaw = (formData.get("price") as string | null) ?? "0";
  const price_cents = parseEuroToCents(priceRaw);
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;

  // Student: try to match by email first, then by full_name. Otherwise store as off-app name.
  const studentInput = ((formData.get("student") as string | null) ?? "").trim();

  if (!session_date) {
    throw new Error("Data e hora obrigatórias.");
  }

  let user_id: string | null = null;
  let student_name: string | null = null;

  if (studentInput) {
    const { data: byEmail } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", studentInput)
      .maybeSingle();

    if (byEmail) {
      user_id = byEmail.id;
    } else {
      const { data: byName } = await supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", studentInput)
        .maybeSingle();

      if (byName) {
        user_id = byName.id;
      } else {
        student_name = studentInput;
      }
    }
  } else {
    student_name = "Sem nome";
  }

  const { error } = await supabase.from("solo_sessions").insert({
    user_id,
    student_name,
    session_date,
    duration_minutes,
    price_cents,
    notes,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/sessions");
  revalidatePath("/admin/earnings");
  redirect("/admin/sessions");
}
