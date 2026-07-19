"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addDays,
  formatDayHeader,
  formatTime,
  mondayOf,
  todayLisbon,
} from "@/lib/schedule";
import { sendWaitlistPromotionEmail, getSiteUrl } from "@/lib/email";
import { isUnpaidAndBlocked } from "@/lib/payment";
import { getBookableUntil } from "@/lib/booking-window";

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
    .select(
      "approved, is_admin, is_blocked, full_name, phone, birthday, has_monthly_fee, joined_at, weekly_class_limit",
    )
    .eq("id", user.id)
    .maybeSingle();

  // Missing name, phone, or birthday — finish /bem-vindo first so the coach
  // never has nameless rows and the dashboard birthday banner works. Admins
  // are exempt.
  if (
    !gateProfile?.is_admin &&
    (!gateProfile?.full_name ||
      !gateProfile?.phone ||
      !gateProfile?.birthday)
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

  // Unpaid past the monthly cutoff — bounce to /perfil, which shows the
  // payment reminder. Grace period + exemptions live in isUnpaidAndBlocked.
  if (gateProfile && (await isUnpaidAndBlocked(user.id, gateProfile))) {
    redirect("/perfil");
  }

  const template_id = formData.get("template_id") as string | null;
  const instance_date = formData.get("instance_date") as string | null;

  if (!template_id || !instance_date) {
    throw new Error("Pedido inválido.");
  }

  // Where to land after this action — the page the form told us about (class
  // detail) or the schedule anchored to the right week. Expected failures
  // redirect here with a toast param instead of throwing: Next masks thrown
  // messages in production, so a throw would show the generic error page.
  const return_to = (formData.get("return_to") as string | null)?.trim();
  const bounce = (param: string): never => {
    if (return_to) {
      const separator = return_to.includes("?") ? "&" : "?";
      redirect(`${return_to}${separator}${param}=1`);
    }
    redirect(`/aulas?week=${mondayOf(instance_date)}&${param}=1`);
  };

  // Booking window — students can only book up to the date the coach has
  // opened with "Abrir próximas 2 semanas". The UI normally prevents this;
  // this is the server-side backstop.
  if (instance_date > (await getBookableUntil())) {
    redirect("/aulas");
  }

  // One class per day (coach's rule): a student can't book a second class on a
  // day they already have an active booking. The UI hides the button, and
  // book_class enforces it atomically (migration 0018) — this pre-check just
  // gives a clean message before we hit the DB.
  const { data: sameDayBooking } = await supabase
    .from("bookings")
    .select("id")
    .eq("user_id", user.id)
    .eq("instance_date", instance_date)
    .neq("template_id", template_id)
    .in("status", ["booked", "waitlisted"])
    .limit(1)
    .maybeSingle();
  if (sameDayBooking) {
    bounce("oneperday");
  }

  // Weekly plan limit (25€→1, 35€→2, 50€→3, 60€→livre/null). Active bookings
  // (booked + waitlisted) in the Mon-Sun week of the target date. The UI hides
  // the button and book_class re-checks atomically (migration 0019) — this
  // pre-check just returns the friendly toast without a DB round-trip to the RPC.
  const weeklyLimit = gateProfile?.weekly_class_limit ?? null;
  if (weeklyLimit !== null) {
    const weekStart = mondayOf(instance_date);
    // Booked always counts; waitlisted only while its class is still upcoming
    // (a passed waitlist that never got promoted must not eat the week).
    const { count: weekCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("instance_date", weekStart)
      .lte("instance_date", addDays(weekStart, 6))
      .or(
        `status.eq.booked,and(status.eq.waitlisted,instance_date.gte.${todayLisbon()})`,
      )
      // Exclude THIS class instance's own row: if the student is already
      // booked here, the RPC's ALREADY_BOOKED should answer (correct toast),
      // not a bogus weekly-limit bounce.
      .or(
        `template_id.neq.${template_id},instance_date.neq.${instance_date}`,
      );
    if ((weekCount ?? 0) >= weeklyLimit) {
      bounce("weeklylimit");
    }
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
      bounce("already");
    }
    if (error.message.includes("BATUS_ONE_PER_DAY")) {
      bounce("oneperday");
    }
    if (error.message.includes("BATUS_WEEKLY_LIMIT")) {
      bounce("weeklylimit");
    }
    throw new Error(error.message);
  }

  revalidatePath("/aulas");
  revalidatePath("/perfil");
  revalidatePath(`/aulas/${template_id}/${instance_date}`);

  bounce(resultStatus === "waitlisted" ? "waitlist" : "booked");
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
      `id, template_id, instance_date, status, class_templates!inner(start_time, name)`,
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
      // Expected case, not an exception: a thrown message would be masked in
      // production. Redirect to /perfil with the cutoff toast instead.
      redirect("/perfil?cutoff=1");
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
      .select("id, user_id")
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

      // Tell the promoted student — they won't be refreshing the app.
      // Best-effort: an unconfigured/failed email never blocks the cancel.
      const { data: promoted } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", nextInLine.user_id)
        .maybeSingle();

      if (promoted?.email) {
        const tpl = booking.class_templates as unknown as {
          start_time: string;
          name: string;
        };
        await sendWaitlistPromotionEmail({
          to: promoted.email,
          studentName: promoted.full_name,
          className: tpl.name,
          dateLabel: formatDayHeader(booking.instance_date),
          timeLabel: formatTime(tpl.start_time),
          siteUrl: getSiteUrl(),
        });
      }
    }
  }

  revalidatePath("/aulas");
  revalidatePath("/admin/calendar");
  revalidatePath("/perfil");
  redirect("/perfil?cancelled=1");
}
