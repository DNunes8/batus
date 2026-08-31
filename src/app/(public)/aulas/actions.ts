"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addDays,
  effectiveStartTime,
  mondayOf,
  resolveClassInstance,
  todayLisbon,
} from "@/lib/schedule";
import {
  canCancelBooking,
  getBookableUntil,
  getCancellationCutoffHours,
} from "@/lib/booking-window";
import { isUnpaidAndBlocked } from "@/lib/payment";
import { promoteFirstWaitlistedIfSeatFree } from "@/lib/waitlist";

export async function bookClass(formData: FormData) {
  const supabase = await createClient();
  const { user, transient } = await getAuthUser(supabase);

  if (!user) {
    // Booking is the most-tapped student action — a transient blip must not
    // eat a valid session and force a re-login. Bounce back with an "offline"
    // toast, still logged in; only a genuine no-session goes to /login.
    if (transient) redirect("/aulas?offline=1");
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
      "approved, is_admin, is_blocked, full_name, phone, birthday, has_monthly_fee, joined_at, weekly_class_limit, class_credits",
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
  // Annotated as a never-returning alias so TypeScript treats the code after
  // a bounce() as unreachable and narrows accordingly.
  const bounce: (param: string) => never = (param) => {
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

  // Pack students need a class in the bank to book (or waitlist). book_class
  // re-checks atomically (BATUS_NO_CREDITS); this is the friendly early bounce.
  if (gateProfile?.class_credits != null && gateProfile.class_credits <= 0) {
    bounce("nocredits");
  }

  // Is this a real, still-bookable class? The schedule only draws instances
  // that pass these tests, but the form's ids arrive from whatever page the
  // student had open — which may predate the coach cancelling the class or
  // closing the day. Without this a stale tab books a class that will not
  // happen: the credit is spent, the one-per-day slot is burned, and the
  // booking never shows on the coach's calendar so he cannot even remove it.
  const resolved = await resolveClassInstance(template_id, instance_date);
  if (!resolved.ok) {
    // "It already started" and "it no longer exists" are different things to
    // hear when you were about to book.
    bounce(resolved.problem === "past" ? "classpast" : "classgone");
  }
  const instance = resolved.instance;

  // Capacity check, the booked-vs-waitlisted decision, and the write all
  // happen atomically inside the book_class DB function (migration 0012):
  // it serializes concurrent bookings for the same class instance with an
  // advisory lock, so two students can't both take the last seat.
  const admin = createAdminClient();
  const { data: resultStatus, error } = await admin.rpc("book_class", {
    p_user_id: user.id,
    p_template_id: template_id,
    p_instance_date: instance_date,
    p_capacity: instance.capacity,
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
    if (error.message.includes("BATUS_NO_CREDITS")) {
      bounce("nocredits");
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
  const { user, transient } = await getAuthUser(supabase);

  if (!user) {
    if (transient) redirect("/perfil?offline=1");
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

  // Cutoff check only applies to confirmed bookings; waitlisted can always
  // cancel. Uses the SAME predicate the /perfil UI uses to decide whether to
  // offer the button, so the two can never disagree — a student must never be
  // shown Cancelar and then refused.
  if (wasBooked) {
    // The coach may have moved this instance with "Adiar" — the new hour lives
    // in class_overrides, not on the template. Measure the cutoff from when the
    // class ACTUALLY starts, or a rescheduled class refuses (or allows) a
    // cancellation against an hour that no longer exists.
    const startTime = await effectiveStartTime(
      booking.template_id,
      booking.instance_date,
      (booking.class_templates as unknown as { start_time: string }).start_time,
    );
    const allowed = canCancelBooking({
      instance_date: booking.instance_date,
      start_time: startTime,
      status: booking.status,
      cutoffHours: await getCancellationCutoffHours(),
    });

    if (!allowed) {
      // Expected case, not an exception: a thrown message would be masked in
      // production. Redirect to /perfil with the cutoff toast instead.
      redirect("/perfil?cutoff=1");
    }
  }

  // Guard the flip on the status we read, and return the affected row: a
  // concurrent double-cancel (double-tap / form resubmit) then matches 0 rows
  // on the second run, so only ONE request runs the side-effects below. Without
  // this, both requests would refund a pack credit (+1 each) — a class minted
  // from nothing.
  const { data: updated, error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", booking_id)
    .eq("status", booking.status)
    .select("id");

  if (error) throw new Error(error.message);

  const didCancel = (updated?.length ?? 0) > 0;

  // Only the request that actually cancelled a CONFIRMED booking refunds the
  // pack credit (no-op for non-pack — the RPC guards on class_credits) and
  // promotes the waitlist into the freed seat.
  if (wasBooked && didCancel) {
    const admin = createAdminClient();
    await admin.rpc("adjust_class_credits", {
      p_user_id: user.id,
      p_delta: 1,
    });
    await promoteFirstWaitlistedIfSeatFree(
      booking.template_id,
      booking.instance_date,
    );
  }

  revalidatePath("/aulas");
  revalidatePath("/admin/calendar");
  revalidatePath("/perfil");
  redirect("/perfil?cancelled=1");
}
