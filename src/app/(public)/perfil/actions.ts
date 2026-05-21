"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBirthdayFromForm } from "@/lib/birthday";

export type ChangePasswordState = {
  error?: string;
} | null;

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const newPassword = (formData.get("new_password") as string | null) ?? "";
  const confirmPassword =
    (formData.get("confirm_password") as string | null) ?? "";

  if (!newPassword || !confirmPassword) {
    return { error: "Preenche os dois campos." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "As palavras-passe não coincidem." };
  }

  if (newPassword.length < 6) {
    return { error: "Palavra-passe demasiado curta — usa 6 ou mais." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/perfil");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/perfil");
  redirect("/perfil?password=1");
}

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
  const birthday = parseBirthdayFromForm(formData);
  const goals = ((formData.get("goals") as string | null) ?? "").trim() || null;

  // Nome, telefone, data de nascimento are required so the coach never has
  // nameless rows in the Alunos list and the dashboard birthday banner works.
  // HTML `required` blocks most users client-side; this is the server backstop.
  if (!full_name || !phone || !birthday) {
    throw new Error("Nome, telefone e data de nascimento são obrigatórios.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, phone, birthday, goals })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/perfil");
  redirect("/perfil?saved=1");
}
