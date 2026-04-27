"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateOwnProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/perfil");
  }

  const full_name = ((formData.get("full_name") as string | null) ?? "").trim() ||
    null;
  const phone = ((formData.get("phone") as string | null) ?? "").trim() || null;
  const goals = ((formData.get("goals") as string | null) ?? "").trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, phone, goals })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/perfil");
}
