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

  // Pending accounts go straight to /perfil — its panel explains that the
  // coach has to approve them before they can book. No point sending them
  // to the schedule with every button locked. Approved users get the normal
  // welcome flow with the toast.
  const { data: prof } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .maybeSingle();

  if (!prof?.approved) {
    redirect("/perfil");
  }

  const separator = next.includes("?") ? "&" : "?";
  redirect(`${next}${separator}welcome=1`);
}
