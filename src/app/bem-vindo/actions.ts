"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CompleteProfileState = {
  error?: string;
} | null;

export async function completeProfile(
  _prev: CompleteProfileState,
  formData: FormData,
): Promise<CompleteProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const full_name =
    ((formData.get("full_name") as string | null) ?? "").trim() || null;
  const phone = ((formData.get("phone") as string | null) ?? "").trim() || null;
  const next = (formData.get("next") as string | null) ?? "/aulas";

  if (!full_name) {
    return { error: "Diz-nos o teu nome." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, phone })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/perfil");
  revalidatePath("/admin/students");

  // Welcome toast surfaces on the next page (default /aulas).
  const separator = next.includes("?") ? "&" : "?";
  redirect(`${next}${separator}welcome=1`);
}
