"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createClassTemplate(formData: FormData) {
  const supabase = await createClient();

  const name = (formData.get("name") as string | null)?.trim();
  const descriptionRaw = (formData.get("description") as string | null)?.trim();
  const day_of_week = Number(formData.get("day_of_week"));
  const start_time = formData.get("start_time") as string | null;
  const duration_minutes = Number(formData.get("duration_minutes"));
  const capacity = Number(formData.get("capacity"));
  const active_from = formData.get("active_from") as string | null;
  const activeUntilRaw = (formData.get("active_until") as string | null)?.trim();

  if (!name || !start_time || !active_from || Number.isNaN(day_of_week)) {
    throw new Error("Campos obrigatórios em falta.");
  }

  const { error } = await supabase.from("class_templates").insert({
    name,
    description: descriptionRaw || null,
    day_of_week,
    start_time,
    duration_minutes,
    capacity,
    active_from,
    active_until: activeUntilRaw || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/classes");
  redirect("/admin/classes");
}

export async function updateClassTemplate(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id") as string | null;
  const name = (formData.get("name") as string | null)?.trim();
  const descriptionRaw = (formData.get("description") as string | null)?.trim();
  const day_of_week = Number(formData.get("day_of_week"));
  const start_time = formData.get("start_time") as string | null;
  const duration_minutes = Number(formData.get("duration_minutes"));
  const capacity = Number(formData.get("capacity"));
  const active_from = formData.get("active_from") as string | null;
  const activeUntilRaw = (formData.get("active_until") as string | null)?.trim();

  if (!id || !name || !start_time || !active_from || Number.isNaN(day_of_week)) {
    throw new Error("Campos obrigatórios em falta.");
  }

  const { error } = await supabase
    .from("class_templates")
    .update({
      name,
      description: descriptionRaw || null,
      day_of_week,
      start_time,
      duration_minutes,
      capacity,
      active_from,
      active_until: activeUntilRaw || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/classes");
  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
  redirect("/admin/classes");
}

export async function deleteClassTemplate(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_templates")
    .delete()
    .eq("id", id);

  if (error) {
    // Likely FK violation if bookings reference it.
    throw new Error(
      "Não é possível apagar — existem marcações para este modelo. Edita as datas para o desativar.",
    );
  }

  revalidatePath("/admin/classes");
  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
}
