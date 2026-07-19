"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth-guard";
import {
  addDays,
  dayOfWeek as dowHelper,
  mondayOf,
  todayLisbon,
} from "@/lib/schedule";
import { parseEuroToCents } from "@/lib/money";

export type CalendarActionState = {
  error?: string;
  success?: boolean;
} | null;

// ============================================================================
// When the coach cancels a class instance (or closes a whole day), the
// affected ACTIVE bookings must be cancelled too — otherwise those students
// stay "booked" on a dead class: the one-per-day rule blocks them from booking
// a replacement, /perfil still lists the class, and stats count it as
// attended. The marker prefix records the pre-cancel status so a restore can
// put everyone back exactly as they were.
// ============================================================================

const COACH_CANCEL_MARKER = "BATUS_CLASS_CANCELLED:";

// Cancel every active booking for a class instance (or, with template_id
// null, for ALL classes on a date — the closed-day case). Service-role
// client: students' rows are outside the coach's RLS reach.
async function cancelInstanceBookings(
  template_id: string | null,
  instance_date: string,
  reason: string,
) {
  const admin = createAdminClient();
  for (const status of ["booked", "waitlisted"] as const) {
    let q = admin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        // Marker + prior status (for restore) + human reason (for the coach).
        cancelled_reason: `${COACH_CANCEL_MARKER}${status}|${reason}`,
      })
      .eq("instance_date", instance_date)
      .eq("status", status);
    if (template_id) q = q.eq("template_id", template_id);
    const { error } = await q;
    if (error) throw new Error(error.message);
  }
}

// Restore bookings that were cancelled by a coach cancel/close — back to
// their recorded status — skipping any student who has meanwhile booked a
// different class that day (one-per-day must keep holding).
async function restoreInstanceBookings(
  template_id: string | null,
  instance_date: string,
) {
  const admin = createAdminClient();

  let markedQ = admin
    .from("bookings")
    .select("id, user_id, cancelled_reason")
    .eq("instance_date", instance_date)
    .eq("status", "cancelled")
    .like("cancelled_reason", `${COACH_CANCEL_MARKER}%`);
  if (template_id) markedQ = markedQ.eq("template_id", template_id);
  const { data: marked } = await markedQ;
  if (!marked || marked.length === 0) return;

  // Same-day active bookings for the affected students → conflicts to skip.
  const userIds = [...new Set(marked.map((m) => m.user_id))];
  const { data: sameDay } = await admin
    .from("bookings")
    .select("user_id")
    .eq("instance_date", instance_date)
    .in("status", ["booked", "waitlisted"])
    .in("user_id", userIds);
  const conflicted = new Set((sameDay ?? []).map((b) => b.user_id));

  // Weekly plan limits: a restore must not push a limited student over their
  // cap (they may have legitimately booked a replacement class this week
  // while the instance was cancelled). Count each limited student's active
  // week bookings the same way book_class does — booked always, waitlisted
  // only while still upcoming.
  const { data: limitedProfiles } = await admin
    .from("profiles")
    .select("id, weekly_class_limit")
    .in("id", userIds)
    .not("weekly_class_limit", "is", null);
  const limitByUser = new Map(
    (limitedProfiles ?? []).map((p) => [p.id, p.weekly_class_limit as number]),
  );
  const weekStart = mondayOf(instance_date);
  const overLimit = new Set<string>();
  if (limitByUser.size > 0) {
    const { data: weekRows } = await admin
      .from("bookings")
      .select("user_id")
      .in("user_id", [...limitByUser.keys()])
      .gte("instance_date", weekStart)
      .lte("instance_date", addDays(weekStart, 6))
      .or(
        `status.eq.booked,and(status.eq.waitlisted,instance_date.gte.${todayLisbon()})`,
      );
    const weekCount = new Map<string, number>();
    for (const b of weekRows ?? []) {
      weekCount.set(b.user_id, (weekCount.get(b.user_id) ?? 0) + 1);
    }
    for (const [uid, limit] of limitByUser) {
      if ((weekCount.get(uid) ?? 0) >= limit) overLimit.add(uid);
    }
  }

  for (const row of marked) {
    const prior = (row.cancelled_reason ?? "")
      .slice(COACH_CANCEL_MARKER.length)
      .split("|")[0];
    if (
      conflicted.has(row.user_id) ||
      overLimit.has(row.user_id) ||
      (prior !== "booked" && prior !== "waitlisted")
    ) {
      // Leave cancelled, but strip the marker so a later restore of another
      // cancel/restore cycle can't resurrect a stale row.
      await admin
        .from("bookings")
        .update({ cancelled_reason: "Aula cancelada pelo estúdio" })
        .eq("id", row.id);
      continue;
    }
    const { error } = await admin
      .from("bookings")
      .update({
        status: prior,
        cancelled_at: null,
        cancelled_reason: null,
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
  }
}

// One-tap "add this model to today". Clones an existing class_template's
// config onto a specific date as a one-off (active_from = active_until = date)
// so the schedule generator renders it just for that day.
export async function createGroupInstanceFromTemplate(input: {
  template_id: string;
  date: string;
}) {
  await assertAdmin();
  const { template_id, date } = input;
  if (!template_id || !date) throw new Error("Pedido inválido.");

  const supabase = await createClient();

  const { data: source, error: fetchErr } = await supabase
    .from("class_templates")
    .select(
      "name, description, start_time, duration_minutes, capacity, is_public",
    )
    .eq("id", template_id)
    .single();

  if (fetchErr || !source) {
    throw new Error("Modelo não encontrado.");
  }

  const { error } = await supabase.from("class_templates").insert({
    name: source.name,
    description: source.description,
    day_of_week: dowHelper(date),
    start_time: source.start_time,
    duration_minutes: source.duration_minutes,
    capacity: source.capacity,
    is_public: source.is_public,
    active_from: date,
    active_until: date,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/classes");
  revalidatePath("/aulas");
}

// Same as above but for PT templates.
export async function createSoloInstanceFromTemplate(input: {
  template_id: string;
  date: string;
}) {
  await assertAdmin();
  const { template_id, date } = input;
  if (!template_id || !date) throw new Error("Pedido inválido.");

  const supabase = await createClient();

  const { data: source, error: fetchErr } = await supabase
    .from("solo_session_templates")
    .select(
      "user_id, student_name, start_time, duration_minutes, price_cents, notes",
    )
    .eq("id", template_id)
    .single();

  if (fetchErr || !source) {
    throw new Error("Modelo não encontrado.");
  }

  const { error } = await supabase.from("solo_session_templates").insert({
    user_id: source.user_id,
    student_name: source.student_name,
    day_of_week: dowHelper(date),
    start_time: source.start_time,
    duration_minutes: source.duration_minutes,
    price_cents: source.price_cents,
    notes: source.notes,
    active_from: date,
    active_until: date,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
}

export async function createClassFromCalendar(
  _prev: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  await assertAdmin();
  const date = formData.get("date") as string | null;
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const start_time = formData.get("start_time") as string | null;
  const duration_minutes = Number(formData.get("duration_minutes") ?? 60);
  const capacity = Number(formData.get("capacity") ?? 8);
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
  await assertAdmin();
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

  // Free the day's students: cancel every active booking on this date so they
  // can book elsewhere (and /perfil + stats stay truthful).
  await cancelInstanceBookings(null, date, reason);

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
  revalidatePath("/perfil");
}

export async function reopenDay(formData: FormData) {
  await assertAdmin();
  const date = formData.get("date") as string | null;
  if (!date) throw new Error("Data inválida.");

  const supabase = await createClient();
  const { error } = await supabase.from("closed_days").delete().eq("date", date);

  if (error) throw new Error(error.message);

  // Put the day's coach-cancelled bookings back (skips students who booked
  // elsewhere in the meantime).
  await restoreInstanceBookings(null, date);

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
  revalidatePath("/perfil");
}

export async function cancelClassInstance(formData: FormData) {
  await assertAdmin();
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

  // Free this class's students so one-per-day doesn't lock them out of a
  // replacement class, and /perfil + stats stop showing a dead booking.
  await cancelInstanceBookings(template_id, instance_date, reason);

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
  revalidatePath("/perfil");
}

export async function restoreClassInstance(formData: FormData) {
  await assertAdmin();
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

  // Bring the cancelled bookings back to their pre-cancel status (skipping
  // students who booked a different class this day in the meantime).
  await restoreInstanceBookings(template_id, instance_date);

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
  revalidatePath("/perfil");
}

// ============================================================================
// Reschedule (adiar) — same day, different time. Uses override_start_time.
// ============================================================================

export async function rescheduleClassInstance(formData: FormData) {
  await assertAdmin();
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
// PT recurring sessions on the calendar
// ============================================================================

export async function createSoloFromCalendar(
  _prev: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  await assertAdmin();
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
  revalidatePath("/admin/pagamentos");
  revalidatePath("/perfil");
  return { success: true };
}

export async function cancelSoloInstance(formData: FormData) {
  await assertAdmin();
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
  revalidatePath("/admin/pagamentos");
}

export async function restoreSoloInstance(formData: FormData) {
  await assertAdmin();
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
  revalidatePath("/admin/pagamentos");
}

export async function rescheduleSoloInstance(formData: FormData) {
  await assertAdmin();
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
