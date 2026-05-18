"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Approve a pending student so they can start booking classes.
// Called from the Alunos list and the student detail page.
export async function approveStudent(formData: FormData) {
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
