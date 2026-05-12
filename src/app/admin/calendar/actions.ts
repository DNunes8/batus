"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dayOfWeek as dowHelper } from "@/lib/schedule";
import { parseEuroToCents } from "@/lib/money";

export type CalendarActionState = {
  error?: string;
  success?: boolean;
} | null;

export async function createClassFromCalendar(
  _prev: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  const date = formData.get("date") as string | null;
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const start_time = formData.get("start_time") as string | null;
  const duration_minutes = Number(formData.get("duration_minutes") ?? 60);
  const capacity = Number(formData.get("capacity") ?? 12);
  const is_public = formData.get("is_public") !== "false";
  const repeat_weekly = formData.get("repeat_weekly") === "on";

  if (!date || !name || !start_time) {
    return { error: "Preenche o nome e a hora." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("class_templates").insert({
    name,
    description: null,
    day_of_week: dowHelper(date),
    start_time,
    duration_minutes,
    capacity,
    active_from: date,
    active_until: repeat_weekly ? null : date,
    is_public,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/classes");
  revalidatePath("/aulas");
  return { success: true };
}

export async function setClosedDay(formData: FormData) {
  const date = formData.get("date") as string | null;
  const reason = ((formData.get("reason") as string | null) ?? "").trim() ||
    "Fechado";

  if (!date) {
    throw new Error("Data inválida.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("closed_days")
    .upsert({ date, reason });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
}

export async function reopenDay(formData: FormData) {
  const date = formData.get("date") as string | null;
  if (!date) throw new Error("Data inválida.");

  const supabase = await createClient();
  const { error } = await supabase.from("closed_days").delete().eq("date", date);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
}

export async function cancelClassInstance(formData: FormData) {
  const template_id = formData.get("template_id") as string | null;
  const instance_date = formData.get("instance_date") as string | null;
  const reason = ((formData.get("reason") as string | null) ?? "").trim() ||
    "Cancelada";

  if (!template_id || !instance_date) {
    throw new Error("Pedido inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_overrides")
    .upsert(
      { template_id, instance_date, cancelled: true, reason },
      { onConflict: "template_id,instance_date" },
    );

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
}

export async function restoreClassInstance(formData: FormData) {
  const template_id = formData.get("template_id") as string | null;
  const instance_date = formData.get("instance_date") as string | null;

  if (!template_id || !instance_date) {
    throw new Error("Pedido inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_overrides")
    .delete()
    .eq("template_id", template_id)
    .eq("instance_date", instance_date);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
}

// ============================================================================
// Reschedule (adiar) — same day, different time. Uses override_start_time.
// ============================================================================

export async function rescheduleClassInstance(formData: FormData) {
  const template_id = formData.get("template_id") as string | null;
  const instance_date = formData.get("instance_date") as string | null;
  const new_start_time = formData.get("new_start_time") as string | null;

  if (!template_id || !instance_date || !new_start_time) {
    throw new Error("Pedido inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("class_overrides").upsert(
    {
      template_id,
      instance_date,
      cancelled: false,
      override_start_time: new_start_time,
    },
    { onConflict: "template_id,instance_date" },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
}

// ============================================================================
// 1:1 recurring sessions on the calendar
// ============================================================================

export async function createSoloFromCalendar(
  _prev: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  const date = formData.get("date") as string | null;
  const studentInput =
    ((formData.get("student") as string | null) ?? "").trim();
  const start_time = formData.get("start_time") as string | null;
  const duration_minutes = Number(formData.get("duration_minutes") ?? 60);
  const priceRaw = (formData.get("price") as string | null) ?? "0";
  const price_cents = parseEuroToCents(priceRaw);
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const repeat_weekly = formData.get("repeat_weekly") === "on";

  if (!date || !studentInput || !start_time) {
    return { error: "Preenche o aluno e a hora." };
  }

  const supabase = await createClient();

  // Fuzzy match: email first, then full_name. Otherwise store as off-app name.
  let user_id: string | null = null;
  let student_name: string | null = null;

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

  const { error } = await supabase.from("solo_session_templates").insert({
    user_id,
    student_name,
    day_of_week: dowHelper(date),
    start_time,
    duration_minutes,
    price_cents,
    notes,
    active_from: date,
    active_until: repeat_weekly ? null : date,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/earnings");
  revalidatePath("/perfil");
  return { success: true };
}

export async function cancelSoloInstance(formData: FormData) {
  const template_id = formData.get("template_id") as string | null;
  const instance_date = formData.get("instance_date") as string | null;
  const reason =
    ((formData.get("reason") as string | null) ?? "").trim() || "Cancelada";

  if (!template_id || !instance_date) {
    throw new Error("Pedido inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("solo_session_overrides").upsert(
    { template_id, instance_date, cancelled: true, reason },
    { onConflict: "template_id,instance_date" },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/earnings");
}

export async function restoreSoloInstance(formData: FormData) {
  const template_id = formData.get("template_id") as string | null;
  const instance_date = formData.get("instance_date") as string | null;

  if (!template_id || !instance_date) {
    throw new Error("Pedido inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("solo_session_overrides")
    .delete()
    .eq("template_id", template_id)
    .eq("instance_date", instance_date);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/earnings");
}

export async function rescheduleSoloInstance(formData: FormData) {
  const template_id = formData.get("template_id") as string | null;
  const instance_date = formData.get("instance_date") as string | null;
  const new_start_time = formData.get("new_start_time") as string | null;

  if (!template_id || !instance_date || !new_start_time) {
    throw new Error("Pedido inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("solo_session_overrides").upsert(
    {
      template_id,
      instance_date,
      cancelled: false,
      override_start_time: new_start_time,
    },
    { onConflict: "template_id,instance_date" },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
}
