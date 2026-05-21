"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mondayOf } from "@/lib/schedule";

export async function bookClass(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/aulas");
  }

  // Approval gate. New accounts can't book until the coach approves them.
  // The UI already locks the button for pending users — this is the
  // server-side backstop. Bounce them to /perfil, which explains the wait.
  // Also re-check is_blocked here: booking inserts now go through the
  // service-role client (see below), which bypasses the RLS not-blocked
  // check, so the action has to enforce it itself.
  const { data: gateProfile } = await supabase
    .from("profiles")
    .select("approved, is_admin, is_blocked, full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  // Missing name or phone — finish /bem-vindo first so the coach never has
  // nameless rows in the Alunos list. Admins are exempt.
  if (
    !gateProfile?.is_admin &&
    (!gateProfile?.full_name || !gateProfile?.phone)
  ) {
    redirect("/bem-vindo");
  }

  if (!gateProfile?.approved && !gateProfile?.is_admin) {
    redirect("/perfil");
  }

  // A paused account can't book new classes. Bounce to /perfil, which shows
  // the "conta em pausa" panel — same graceful handling as the gate above.
  if (gateProfile?.is_blocked) {
    redirect("/perfil");
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

  // Capacity check, the booked-vs-waitlisted decision, and the write all
  // happen atomically inside the book_class DB function (migration 0012):
  // it serializes concurrent bookings for the same class instance with an
  // advisory lock, so two students can't both take the last seat.
  const admin = createAdminClient();
  const { data: resultStatus, error } = await admin.rpc("book_class", {
    p_user_id: user.id,
    p_template_id: template_id,
    p_instance_date: instance_date,
    p_capacity: template.capacity,
  });

  if (error) {
    if (error.message.includes("BATUS_ALREADY_BOOKED")) {
      throw new Error("Já tens marcação para esta aula.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/aulas");
  revalidatePath("/perfil");
  revalidatePath(`/aulas/${template_id}/${instance_date}`);

  // If the form told us where to return to (e.g. the class detail page),
  // bounce back there with the toast. Otherwise default to the schedule
  // pre-anchored to the right week.
  const status_param = resultStatus === "waitlisted" ? "waitlist" : "booked";
  const return_to = (formData.get("return_to") as string | null)?.trim();
  if (return_to) {
    const separator = return_to.includes("?") ? "&" : "?";
    redirect(`${return_to}${separator}${status_param}=1`);
  }
  const week = mondayOf(instance_date);
  redirect(`/aulas?week=${week}&${status_param}=1`);
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
  revalidatePath("/perfil");
  redirect("/perfil?cancelled=1");
}
