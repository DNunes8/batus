"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth-guard";
import { parseEuroToCents } from "@/lib/money";
import {
  addDays,
  dayOfWeek as dowHelper,
  mondayOf,
  todayLisbon,
} from "@/lib/schedule";

export async function createClassTemplate(formData: FormData) {
  await assertAdmin();
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

  const is_public = formData.get("is_public") !== "false";

  const { error } = await supabase.from("class_templates").insert({
    name,
    description: descriptionRaw || null,
    day_of_week,
    start_time,
    duration_minutes,
    capacity,
    active_from,
    active_until: activeUntilRaw || null,
    is_public,
  });

  if (error) {
    throw new Error(error.message);
  }

  // Find the first concrete instance of this template (next matching
  // day-of-week from active_from) so we can land the user on the
  // calendar week that actually contains their new class.
  let cursor = active_from;
  for (let i = 0; i < 7; i++) {
    if (day_of_week === dowHelper(cursor)) break;
    cursor = addDays(cursor, 1);
  }

  revalidatePath("/admin/classes");
  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
  redirect(`/admin/calendar?week=${mondayOf(cursor)}&saved=1`);
}

export async function updateClassTemplate(formData: FormData) {
  await assertAdmin();
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

  const is_public = formData.get("is_public") !== "false";

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
      is_public,
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
  await assertAdmin();
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

// ============================================================================
// PT templates — managed on the Modelos page. A row is a "preset"
// (is_preset = true) when it's a reusable model that does NOT auto-render on
// the calendar; otherwise it's a recurring PT that auto-fills every week.
// ============================================================================

type DbClient = Awaited<ReturnType<typeof createClient>>;

// Resolve the free-text student field to a linked account (by email, then by
// name) or, failing both, an off-app name string. Mirrors the matching used
// by the calendar + sessions forms so a PT template points at the same record.
async function resolveStudent(
  supabase: DbClient,
  input: string,
): Promise<{ user_id: string | null; student_name: string | null }> {
  const { data: byEmail } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", input)
    .maybeSingle();
  if (byEmail) return { user_id: byEmail.id, student_name: null };

  const { data: byName } = await supabase
    .from("profiles")
    .select("id")
    .ilike("full_name", input)
    .maybeSingle();
  if (byName) return { user_id: byName.id, student_name: null };

  return { user_id: null, student_name: input };
}

function readSoloTemplateForm(formData: FormData) {
  const student = ((formData.get("student") as string | null) ?? "").trim();
  const day_of_week = Number(formData.get("day_of_week"));
  const start_time = formData.get("start_time") as string | null;
  const duration_minutes = Number(formData.get("duration_minutes") ?? 60);
  const price_cents = parseEuroToCents(
    (formData.get("price") as string | null) ?? "0",
  );
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  // The form's mode select sends "preset" or "recurring".
  const is_preset = formData.get("mode") === "preset";

  if (!student || !start_time || Number.isNaN(day_of_week)) {
    throw new Error("Preenche o aluno, o dia e a hora.");
  }
  return {
    student,
    day_of_week,
    start_time,
    duration_minutes,
    price_cents,
    notes,
    is_preset,
  };
}

export async function createSoloTemplate(formData: FormData) {
  await assertAdmin();
  const supabase = await createClient();
  const f = readSoloTemplateForm(formData);
  const { user_id, student_name } = await resolveStudent(supabase, f.student);

  const { error } = await supabase.from("solo_session_templates").insert({
    user_id,
    student_name,
    day_of_week: f.day_of_week,
    start_time: f.start_time,
    duration_minutes: f.duration_minutes,
    price_cents: f.price_cents,
    notes: f.notes,
    is_preset: f.is_preset,
    // active_from = today so a recurring PT starts this week; active_until
    // null = ongoing. Both are irrelevant for a preset (it never renders).
    active_from: todayLisbon(),
    active_until: null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/classes");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/pagamentos");
  revalidatePath("/perfil");
  redirect("/admin/classes");
}

export async function updateSoloTemplate(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const f = readSoloTemplateForm(formData);
  const { user_id, student_name } = await resolveStudent(supabase, f.student);

  // active_from / active_until are left untouched — flipping the mode is just
  // the is_preset flag, so a preset ↔ recurring switch needs no date juggling.
  const { error } = await supabase
    .from("solo_session_templates")
    .update({
      user_id,
      student_name,
      day_of_week: f.day_of_week,
      start_time: f.start_time,
      duration_minutes: f.duration_minutes,
      price_cents: f.price_cents,
      notes: f.notes,
      is_preset: f.is_preset,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/classes");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/pagamentos");
  revalidatePath("/perfil");
  redirect("/admin/classes");
}

export async function deleteSoloTemplate(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  // solo_session_overrides cascade on delete; no bookings reference PTs.
  const { error } = await supabase
    .from("solo_session_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/classes");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/pagamentos");
  revalidatePath("/perfil");
}
