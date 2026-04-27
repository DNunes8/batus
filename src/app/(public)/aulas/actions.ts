"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function bookClass(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/aulas");
  }

  const template_id = formData.get("template_id") as string | null;
  const instance_date = formData.get("instance_date") as string | null;

  if (!template_id || !instance_date) {
    throw new Error("Pedido inválido.");
  }

  const { data: template } = await supabase
    .from("class_templates")
    .select("capacity")
    .eq("id", template_id)
    .single();

  if (!template) {
    throw new Error("Aula não encontrada.");
  }

  // Service-role count for accurate capacity check (RLS hides other users' bookings).
  const admin = createAdminClient();
  const { count: bookedCount } = await admin
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("template_id", template_id)
    .eq("instance_date", instance_date)
    .eq("status", "booked");

  const isFull = (bookedCount ?? 0) >= template.capacity;

  let waitlist_position: number | null = null;
  if (isFull) {
    const { count: waitlistCount } = await admin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("template_id", template_id)
      .eq("instance_date", instance_date)
      .eq("status", "waitlisted");
    waitlist_position = (waitlistCount ?? 0) + 1;
  }

  // Unique constraint on (user_id, template_id, instance_date) means we
  // can't insert twice. If a cancelled row exists, update it back to active.
  const { data: existing } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("template_id", template_id)
    .eq("instance_date", instance_date)
    .maybeSingle();

  if (existing) {
    if (existing.status === "booked" || existing.status === "waitlisted") {
      throw new Error("Já tens marcação para esta aula.");
    }
    const { error } = await supabase
      .from("bookings")
      .update({
        status: isFull ? "waitlisted" : "booked",
        waitlist_position,
        cancelled_at: null,
        cancelled_reason: null,
        booked_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("bookings").insert({
      user_id: user.id,
      template_id,
      instance_date,
      status: isFull ? "waitlisted" : "booked",
      waitlist_position,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/aulas");
}

export async function cancelBooking(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const booking_id = formData.get("booking_id") as string | null;
  if (!booking_id) {
    throw new Error("Pedido inválido.");
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `id, template_id, instance_date, status, class_templates!inner(start_time)`,
    )
    .eq("id", booking_id)
    .single();

  if (!booking) {
    throw new Error("Marcação não encontrada.");
  }

  const wasBooked = booking.status === "booked";

  // Cutoff check only applies to confirmed bookings; waitlisted can always cancel.
  if (wasBooked) {
    const { data: settingRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "cancellation_cutoff_hours")
      .single();
    const cutoffHours = Number(settingRow?.value ?? 4);

    const startTime = (booking.class_templates as unknown as {
      start_time: string;
    }).start_time;
    // Note: server may run in UTC; Lisbon offset varies with DST. Off by at
    // most ~1h either way — acceptable for MVP. Refine with date-fns-tz later.
    const classDateTime = new Date(`${booking.instance_date}T${startTime}`);
    const cutoffMs = classDateTime.getTime() - cutoffHours * 60 * 60 * 1000;

    if (Date.now() > cutoffMs) {
      throw new Error(
        `Só podes cancelar até ${cutoffHours}h antes da aula.`,
      );
    }
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", booking_id);

  if (error) throw new Error(error.message);

  // If a confirmed slot opened up, promote the first waitlisted person.
  // Use the admin client because the user can't see other students' bookings.
  if (wasBooked) {
    const admin = createAdminClient();
    const { data: nextInLine } = await admin
      .from("bookings")
      .select("id")
      .eq("template_id", booking.template_id)
      .eq("instance_date", booking.instance_date)
      .eq("status", "waitlisted")
      .order("waitlist_position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextInLine) {
      await admin
        .from("bookings")
        .update({ status: "booked", waitlist_position: null })
        .eq("id", nextInLine.id);
      // Day 6: send notification email to the promoted student.
    }
  }

  revalidatePath("/aulas");
  revalidatePath("/admin/calendar");
}
