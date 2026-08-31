"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth-guard";
import {
  addDays,
  dayOfWeek as dowHelper,
  effectiveStartTime,
  formatDayHeader,
  formatTime,
  getStartTimeOverrides,
  isClassInPast,
  lisbonInstant,
  mondayOf,
  todayLisbon,
} from "@/lib/schedule";
import { parseEuroToCents } from "@/lib/money";
import { promoteFirstWaitlistedIfSeatFree } from "@/lib/waitlist";
import {
  getSiteUrl,
  sendClassCancelledBatch,
  sendClassRescheduledBatch,
  sendClassRestoredBatch,
  sendCoachAddedEmail,
} from "@/lib/email";

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

  // Flip the rows and act ONLY on what this call actually changed. Reading the
  // list first and acting on that would let a double-tap (two requests reading
  // the same active rows before either writes) refund the same credit twice —
  // the update's own result is the single source of truth for "I am the request
  // that cancelled this booking", the same guard the student cancel uses.
  //
  // Waitlisted first: a promotion landing in the gap moves a row
  // waitlisted -> booked, and the second pass then catches it. The other order
  // would let that row escape the cancel entirely.
  const affected: {
    booking_id: string;
    user_id: string;
    template_id: string;
    priorStatus: "booked" | "waitlisted";
    className: string;
    templateStartTime: string;
    refunded: boolean;
  }[] = [];

  for (const status of ["waitlisted", "booked"] as const) {
    let q = admin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        // Marker + prior status + settlement flag (n = no credit returned yet)
        // + human reason. The restore reads the flag rather than guessing from
        // the student's current balance.
        cancelled_reason: `${COACH_CANCEL_MARKER}${status}:n|${reason}`,
      })
      .eq("instance_date", instance_date)
      .eq("status", status);
    if (template_id) q = q.eq("template_id", template_id);
    const { data: flipped, error } = await q.select(
      "id, user_id, template_id, class_templates!inner(name, start_time)",
    );
    if (error) throw new Error(error.message);
    for (const row of flipped ?? []) {
      const tpl = row.class_templates as unknown as {
        name: string;
        start_time: string;
      };
      affected.push({
        booking_id: row.id as string,
        user_id: row.user_id as string,
        template_id: row.template_id as string,
        priorStatus: status,
        className: tpl.name,
        templateStartTime: tpl.start_time,
        refunded: false,
      });
    }
  }

  if (affected.length === 0) return;

  // Effective start times ("Adiar" moves the hour without touching the
  // template), used both to skip classes that already happened and to tell the
  // student the hour they were actually expecting.
  const overrides = await getStartTimeOverrides(
    affected.map((r) => ({ template_id: r.template_id, instance_date })),
  );
  const startTimeOf = (r: { template_id: string; templateStartTime: string }) =>
    overrides.get(`${r.template_id}|${instance_date}`) ?? r.templateStartTime;

  // Tidying up a class that already happened is bookkeeping, not a
  // cancellation: nobody is owed a credit back for a class that ran, and
  // emailing "esta aula não se vai realizar" about last Tuesday is nonsense.
  // The booking rows are still flipped above — only the money and the mail are
  // skipped.
  const upcoming = affected.filter(
    (r) => !isClassInPast(instance_date, startTimeOf(r)),
  );
  if (upcoming.length === 0) return;

  // Who holds a pack, and where do we write to them: one query, used by both
  // halves below. Closing a busy day used to fire a credits RPC plus a row
  // update for EVERY booked student — dozens of subrequests before a single
  // email was sent, which on Workers means the action dies partway and the
  // day is left cancelled with nobody told. Only pack students hold credits
  // (class_credits is null for everyone else), and the RPC is a no-op for the
  // rest, so skipping them costs nothing and keeps the request small.
  const userIds = [...new Set(upcoming.map((r) => r.user_id))];
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, email, full_name, class_credits")
    .in("id", userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  // If that read failed we know nothing about who holds a pack, and an empty
  // map would read as "nobody does" — silently swallowing every refund on a
  // day the studio cancelled. Fall back to asking the RPC about each booked
  // row, the way this did before the pack shortcut existed: slower, but it
  // cannot lose a credit. Retrying the cancel would not help — the bookings
  // are already flipped, so a second run finds nothing to refund.
  const packUnknown = !!profilesError || !profiles;
  if (packUnknown) {
    console.error(
      `[calendar] PROFILE READ FAILED on ${instance_date}; refunding without the pack shortcut:`,
      profilesError?.message ?? "no rows returned",
    );
  }

  // Give pack students their class back. The studio cancelled — they must not
  // pay for a class that never ran. Refunding here (rather than leaving the
  // credit "parked" in the cancelled row) means no booking ever carries an
  // unsettled credit, so a re-book charges normally.
  const refundedBookingIds: string[] = [];
  for (const row of upcoming) {
    if (row.priorStatus !== "booked") continue; // waitlist never spent a credit
    if (!packUnknown && byId.get(row.user_id)?.class_credits == null) {
      continue; // not a pack
    }
    try {
      const { data: newBalance, error: refundError } = await admin.rpc(
        "adjust_class_credits",
        { p_user_id: row.user_id, p_delta: 1 },
      );
      if (!refundError && packUnknown && newBalance == null) {
        continue; // the RPC's own answer: not a pack student
      }
      if (refundError) {
        // Loud: a swallowed failure here means a student quietly paid for a
        // class that never ran, and nothing else in the system would notice.
        console.error(
          `[calendar] CREDIT REFUND FAILED for user ${row.user_id} on ${instance_date}:`,
          refundError.message,
        );
        continue;
      }
      row.refunded = true;
      refundedBookingIds.push(row.booking_id);
    } catch (err) {
      console.error("[calendar] credit refund threw:", err);
    }
  }

  // Record the settlement in the rows themselves, in one update. The restore
  // must charge only when a refund actually landed — deriving that from the
  // student's current balance would double-charge whenever a refund failed.
  // Every id here is a prior "booked" row, so one marker fits them all.
  if (refundedBookingIds.length > 0) {
    const { error: markError } = await admin
      .from("bookings")
      .update({
        cancelled_reason: `${COACH_CANCEL_MARKER}booked:r|${reason}`,
      })
      .in("id", refundedBookingIds);
    if (markError) {
      console.error(
        `[calendar] REFUND MARKER FAILED on ${instance_date} (a later restore will not charge these back):`,
        markError.message,
      );
    }
  }

  // The same failed read would also leave us with no addresses, so the day
  // would be cancelled with nobody told. Ask once more before giving up —
  // these failures are transient, and one extra query is cheap next to 26
  // students turning up at a locked door.
  if (packUnknown) {
    const { data: retry } = await admin
      .from("profiles")
      .select("id, email, full_name, class_credits")
      .in("id", userIds);
    for (const p of retry ?? []) byId.set(p.id, p);
    if (byId.size === 0) {
      console.error(
        `[calendar] NO ADDRESSES for ${instance_date} — the class was cancelled but NOBODY was emailed.`,
      );
    }
  }

  // Tell them, in ONE batched send. A per-student POST inside a server action
  // would blow the Workers subrequest budget on a busy day and half-deliver.
  // Best-effort: a mail problem must never leave the class half-cancelled.
  try {
    const recipients = upcoming.flatMap((row) => {
      const profile = byId.get(row.user_id);
      if (!profile?.email) return [];
      return [
        {
          to: profile.email,
          studentName: profile.full_name,
          className: row.className,
          timeLabel: formatTime(startTimeOf(row)),
          // Per ROW, not per user: someone with two bookings that day may have
          // been refunded for one and not the other.
          refunded: row.refunded,
        },
      ];
    });

    await sendClassCancelledBatch(recipients, {
      dateLabel: formatDayHeader(instance_date),
      reason,
      siteUrl: getSiteUrl(),
    });
  } catch (err) {
    console.error("[calendar] cancellation emails failed:", err);
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
    .select(
      "id, user_id, template_id, cancelled_reason, class_templates!inner(name, start_time)",
    )
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

  // A day can be reopened while individual classes on it are still cancelled
  // in their own right. Those bookings must stay cancelled — reopening the day
  // is not the same as un-cancelling every class in it.
  const { data: stillCancelled } = await admin
    .from("class_overrides")
    .select("template_id")
    .eq("instance_date", instance_date)
    .eq("cancelled", true);
  const cancelledTemplates = new Set(
    (stillCancelled ?? []).map((o) => o.template_id as string),
  );

  // Weekly plan limits: a restore must not push a limited student over their
  // cap (they may have legitimately booked a replacement class this week
  // while the instance was cancelled). Count each limited student's active
  // week bookings the same way book_class does — booked always, waitlisted
  // only while still upcoming.
  const { data: userProfiles } = await admin
    .from("profiles")
    .select("id, email, full_name, weekly_class_limit, class_credits")
    .in("id", userIds);
  const limitByUser = new Map(
    (userProfiles ?? [])
      .filter((p) => p.weekly_class_limit !== null)
      .map((p) => [p.id, p.weekly_class_limit as number]),
  );
  const profileById = new Map((userProfiles ?? []).map((p) => [p.id, p]));

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

  const overrides = await getStartTimeOverrides(
    marked.map((m) => ({
      template_id: m.template_id as string,
      instance_date,
    })),
  );

  const restoredRecipients: {
    to: string;
    studentName: string | null;
    className: string;
    timeLabel: string;
    charged: boolean;
  }[] = [];

  // Sort the rows first, act in batches after. Reopening a busy day used to
  // cost one or two writes PER STUDENT, which on Workers means the action can
  // run out of subrequests and stop halfway — some seats back, some not, and
  // credits already taken for rows that were never restored.
  type Marked = (typeof marked)[number];
  const staleIds: string[] = []; // stay cancelled, marker stripped
  const toRestore: {
    row: Marked;
    prior: "booked" | "waitlisted";
    // Per ROW, not per user: someone with two bookings that day may have been
    // charged for one and not the other.
    charged: boolean;
  }[] = [];

  for (const row of marked) {
    // Marker is BATUS_CLASS_CANCELLED:<status>[:<r|n>]|<reason>. Rows written
    // before the settlement flag existed carry no flag — and were never
    // refunded — so the absent case must mean "do not charge".
    const head = (row.cancelled_reason ?? "")
      .slice(COACH_CANCEL_MARKER.length)
      .split("|")[0];
    const [prior, settled] = head.split(":");
    const wasRefunded = settled === "r";

    // The class itself is still cancelled — leave this row alone entirely.
    // Stripping the marker here would make that class's own "Restaurar"
    // permanently a no-op, because the marker is how it finds these rows.
    if (cancelledTemplates.has(row.template_id as string)) continue;

    if (
      conflicted.has(row.user_id) ||
      overLimit.has(row.user_id) ||
      (prior !== "booked" && prior !== "waitlisted")
    ) {
      // Leave cancelled, but strip the marker so a later cancel/restore cycle
      // can't resurrect a stale row. Any refunded credit stays refunded — the
      // student keeps the class they paid for.
      staleIds.push(row.id as string);
      continue;
    }

    // Take the credit back BEFORE handing back the seat, and only if the cancel
    // actually returned one — which only ever happened for pack students, so
    // this loop touches nobody else. charge_class_credit refuses (returns
    // false) rather than clamping at zero, so a student who has since spent the
    // credit is not silently restored for free.
    let charged = false;
    // Only a pack student was ever refunded, but they may have moved to a
    // monthly plan since — and a monthly student needs no credit to hold a
    // seat. charge_class_credit refuses for them exactly as it refuses an
    // empty pack, so without this the seat would never come back and the
    // marker would be stripped, putting it beyond a second attempt.
    const stillOnAPack = profileById.get(row.user_id)?.class_credits != null;
    if (wasRefunded && prior === "booked" && stillOnAPack) {
      const { data: didCharge, error: chargeError } = await admin.rpc(
        "charge_class_credit",
        { p_user_id: row.user_id },
      );
      if (chargeError || didCharge !== true) {
        if (chargeError) {
          console.error(
            `[calendar] CREDIT CHARGE FAILED for user ${row.user_id} on ${instance_date}:`,
            chargeError.message,
          );
        }
        // Can't pay (or couldn't be charged) → don't restore the seat.
        staleIds.push(row.id as string);
        continue;
      }
      charged = true;
    }

    toRestore.push({ row, prior, charged });
  }

  if (staleIds.length > 0) {
    const { error } = await admin
      .from("bookings")
      .update({ cancelled_reason: "Aula cancelada pelo estúdio" })
      .in("id", staleIds);
    if (error) {
      console.error("[calendar] stale marker cleanup failed:", error.message);
    }
  }

  // Flip the seats back, one statement per prior status, each still guarded on
  // status = 'cancelled' so a concurrent second restore matches no rows. The
  // returned ids are the rows THIS call actually restored.
  const restoredIds = new Set<string>();
  let flipError: Error | null = null;
  try {
    for (const status of ["booked", "waitlisted"] as const) {
      const ids = toRestore
        .filter((t) => t.prior === status)
        .map((t) => t.row.id as string);
      if (ids.length === 0) continue;
      const { data: flipped, error } = await admin
        .from("bookings")
        .update({ status, cancelled_at: null, cancelled_reason: null })
        .in("id", ids)
        .eq("status", "cancelled")
        .select("id");
      if (error) throw new Error(error.message);
      for (const r of flipped ?? []) restoredIds.add(r.id as string);
    }
  } catch (err) {
    // Do NOT leave here without paying the credits back. The charges above all
    // happened before any seat was flipped, so throwing straight out would take
    // a credit from every pack student on the day and give back not one seat —
    // and their rows would still say ":r", so the coach's next attempt would
    // charge them a second time.
    flipError = err instanceof Error ? err : new Error(String(err));
  }

  // Anything charged for a seat that didn't come back (someone else restored it
  // first, or the flip above failed) gets its credit returned, so one seat is
  // never paid for twice.
  const refundBack = new Map<string, number>();
  for (const { row, charged } of toRestore) {
    if (!charged || restoredIds.has(row.id as string)) continue;
    refundBack.set(row.user_id, (refundBack.get(row.user_id) ?? 0) + 1);
  }
  for (const [uid, n] of refundBack) {
    const { error } = await admin.rpc("adjust_class_credits", {
      p_user_id: uid,
      p_delta: n,
    });
    if (error) {
      console.error(
        `[calendar] COULD NOT RETURN ${n} credit(s) to user ${uid} after a failed restore on ${instance_date}:`,
        error.message,
      );
    }
  }

  if (flipError) throw flipError;

  for (const { row, charged } of toRestore) {
    if (!restoredIds.has(row.id as string)) continue;
    const profile = profileById.get(row.user_id);
    const tpl = row.class_templates as unknown as {
      name: string;
      start_time: string;
    };
    if (profile?.email) {
      restoredRecipients.push({
        to: profile.email,
        studentName: profile.full_name,
        className: tpl.name,
        timeLabel: formatTime(
          overrides.get(`${row.template_id}|${instance_date}`) ??
            tpl.start_time,
        ),
        charged,
      });
    }
  }

  // The cancellation was announced, so the un-cancellation must be too —
  // otherwise a student who was told the class was off is silently re-booked
  // (and re-charged) and finds out by not turning up.
  if (restoredRecipients.length > 0) {
    try {
      await sendClassRestoredBatch(restoredRecipients, {
        dateLabel: formatDayHeader(instance_date),
        siteUrl: getSiteUrl(),
      });
    } catch (err) {
      console.error("[calendar] restore emails failed:", err);
    }
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

  // The whole day may have been closed since — from another device, or by the
  // coach forgetting. A closed day renders no classes at all, so restoring one
  // into it would put students back on a seat nobody can see, with an email
  // telling them the class is on. Reopen the day first. Every sibling write
  // path (guests, adding a student) already refuses this way.
  const { data: closed, error: closedError } = await supabase
    .from("closed_days")
    .select("date")
    .eq("date", instance_date)
    .maybeSingle();
  // Fail closed: if we can't tell whether the day is open, don't restore into
  // it. A retry costs the coach one tap; guessing wrong puts students back on
  // a seat the app doesn't draw and emails them that the class is on.
  if (closed || closedError) {
    redirect(
      `/admin/calendar?week=${mondayOf(instance_date)}&day=${instance_date}&dayclosed=1`,
    );
  }

  // Un-cancel, don't delete. The row also carries override_start_time (the
  // coach's "Adiar") and override_capacity; deleting it silently reverted an
  // 18:00 -> 19:00 move back to 18:00 — and, because the row was already gone
  // by the time the restore emails were built, told every student the old
  // hour. Clearing just the cancellation leaves the rest of the row intact.
  const { error } = await supabase
    .from("class_overrides")
    .update({ cancelled: false, reason: null })
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

  // The hour they were expecting, before we overwrite it.
  const admin = createAdminClient();
  const { data: template } = await admin
    .from("class_templates")
    .select("name, start_time")
    .eq("id", template_id)
    .maybeSingle();
  const oldStartTime = template
    ? await effectiveStartTime(template_id, instance_date, template.start_time)
    : null;

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

  // Tell everyone who is booked. Moving a class without telling anyone is how
  // a student turns up an hour late (or early) to a class they did book.
  //
  // Compare on the DISPLAYED time: the stored value is HH:MM:SS while the form
  // sends HH:MM, so a raw string compare treats re-saving the same hour as a
  // change and mails the whole roster "18:00 -> 18:00". Also skip a class that
  // has already happened, and send in ONE batch rather than a POST per student.
  // Best-effort: the reschedule itself must not fail on a mail problem.
  const timeChanged =
    !!oldStartTime && formatTime(oldStartTime) !== formatTime(new_start_time);
  const alreadyRan = isClassInPast(instance_date, new_start_time);

  if (template && timeChanged && !alreadyRan) {
    try {
      const { data: rows } = await admin
        .from("bookings")
        .select("user_id")
        .eq("template_id", template_id)
        .eq("instance_date", instance_date)
        .in("status", ["booked", "waitlisted"]);
      const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("email, full_name")
          .in("id", userIds);
        const recipients = (profiles ?? []).flatMap((p) =>
          p.email
            ? [
                {
                  to: p.email,
                  studentName: p.full_name,
                  className: template.name,
                  timeLabel: formatTime(new_start_time),
                  oldTimeLabel: formatTime(oldStartTime!),
                },
              ]
            : [],
        );
        await sendClassRescheduledBatch(recipients, {
          dateLabel: formatDayHeader(instance_date),
          newTimeLabel: formatTime(new_start_time),
          siteUrl: getSiteUrl(),
        });
      }
    } catch (err) {
      console.error("[calendar] reschedule emails failed:", err);
    }
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
  revalidatePath("/perfil");
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
  // Same as the group restore: keep override_start_time, drop only the
  // cancellation. A deleted row takes the "Adiar" with it.
  const { error } = await supabase
    .from("solo_session_overrides")
    .update({ cancelled: false, reason: null })
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

// ============================================================================
// Guests ("aula experimental" / manual placement) — the coach adds a person by
// name to a class instance. The guest takes a real seat (schedule + book_class
// count them); adding is ALWAYS allowed, even past capacity — coach's call.
// ============================================================================

export async function addClassGuest(formData: FormData) {
  await assertAdmin();
  const template_id = formData.get("template_id") as string | null;
  const instance_date = formData.get("instance_date") as string | null;
  const name = ((formData.get("name") as string | null) ?? "")
    .trim()
    .slice(0, 120);

  if (!template_id || !instance_date || !name) {
    throw new Error("Preenche o nome.");
  }

  const supabase = await createClient();

  // Same stale-tab guard as addStudentToClass: no seats on a closed day.
  const { data: closed } = await supabase
    .from("closed_days")
    .select("date")
    .eq("date", instance_date)
    .maybeSingle();
  if (closed) throw new Error("O estúdio está fechado neste dia.");

  const { error } = await supabase.from("class_guests").insert({
    template_id,
    instance_date,
    name,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/students");
  revalidatePath("/aulas");
}

export async function removeClassGuest(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  // Grab the instance BEFORE deleting so we can promote into the freed seat.
  const { data: guest } = await supabase
    .from("class_guests")
    .select("template_id, instance_date")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("class_guests").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // The guest's seat is free — promote the first waitlisted student if the
  // class genuinely has room now (helper re-counts booked + guests).
  if (guest) {
    await promoteFirstWaitlistedIfSeatFree(
      guest.template_id,
      guest.instance_date,
    );
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/students");
  revalidatePath("/aulas");
}

// ============================================================================
// Add ONE student to a class instance — the other half of "ceder vagas": a
// spot opened (or the coach simply decides), and a named student goes in as a
// REAL confirmed booking (shows on /perfil, counts stats, spends a pack
// credit) — unlike a guest, which is just a name holding a seat.
//
// Two-step by design: called without `confirmed`, it returns informational
// warnings (class full / weekly limit reached / another class that day / paused
// account) for the UI to show in a calm confirm — the coach's OK IS the
// override, so the actual booking (admin_book_class) skips those rules. What
// it never skips: an empty pack (BATUS_NO_CREDITS) and already-started classes.
// ============================================================================

export async function addStudentToClass(input: {
  user_id: string;
  template_id: string;
  instance_date: string;
  confirmed?: boolean;
}): Promise<{
  ok?: true;
  emailed?: boolean;
  warnings?: string[];
  error?: string;
}> {
  await assertAdmin();
  const { user_id, template_id, instance_date } = input;
  if (
    !user_id ||
    !template_id ||
    !/^\d{4}-\d{2}-\d{2}$/.test(instance_date ?? "")
  ) {
    return { error: "Pedido inválido." };
  }

  const admin = createAdminClient();
  const [profileRes, templateRes, overrideRes, existingRes, closedRes] =
    await Promise.all([
      admin
        .from("profiles")
        .select(
          "id, full_name, email, approved, is_blocked, weekly_class_limit, class_credits",
        )
        .eq("id", user_id)
        .maybeSingle(),
      admin
        .from("class_templates")
        .select("name, start_time, capacity")
        .eq("id", template_id)
        .maybeSingle(),
      admin
        .from("class_overrides")
        .select("cancelled, override_capacity, override_start_time")
        .eq("template_id", template_id)
        .eq("instance_date", instance_date)
        .maybeSingle(),
      admin
        .from("bookings")
        .select("status")
        .eq("user_id", user_id)
        .eq("template_id", template_id)
        .eq("instance_date", instance_date)
        .in("status", ["booked", "waitlisted"])
        .maybeSingle(),
      admin
        .from("closed_days")
        .select("date")
        .eq("date", instance_date)
        .maybeSingle(),
    ]);

  const profile = profileRes.data;
  const template = templateRes.data;
  const override = overrideRes.data;
  if (!profile) return { error: "Aluno não encontrado." };
  if (!template) return { error: "Aula não encontrada." };
  if (override?.cancelled) return { error: "A aula está cancelada neste dia." };
  // Stale-tab guard, same threat as the cancelled-instance stop above: a day
  // closed from another device renders NO calendar entries, so a booking
  // forced onto it would be invisible and unremovable — and would burn a pack
  // credit on a class that won't happen.
  if (closedRes.data) return { error: "O estúdio está fechado neste dia." };

  // Same started-class gate as removeStudentBooking: adding into the past
  // would mint stats/streak retroactively and spend a credit on a class that
  // already happened. The UI hides the picker on past days; this backs it up.
  const startTime = override?.override_start_time ?? template.start_time;
  const classStart = lisbonInstant(instance_date, startTime);
  if (Date.now() >= classStart.getTime()) {
    return { error: "A aula já começou." };
  }

  if (existingRes.data?.status === "booked") {
    return { error: "Já está nesta aula." };
  }
  const isWaitlisted = existingRes.data?.status === "waitlisted";

  // The one hard money stop — the RPC guards this atomically too; checking
  // here just gives the coach the friendly message before any confirm.
  if (profile.class_credits !== null && profile.class_credits <= 0) {
    return { error: "Pack sem aulas. Ajusta o pack na página do aluno." };
  }

  if (!input.confirmed) {
    // Informational only — the rules the coach may override, surfaced the way
    // book_class would have enforced them. Recomputed fresh; never blocking.
    const warnings: string[] = [];

    const capacity = override?.override_capacity ?? template.capacity;
    const [bookedRes, guestsRes] = await Promise.all([
      admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("template_id", template_id)
        .eq("instance_date", instance_date)
        .eq("status", "booked"),
      admin
        .from("class_guests")
        .select("id", { count: "exact", head: true })
        .eq("template_id", template_id)
        .eq("instance_date", instance_date),
    ]);
    const seats = (bookedRes.count ?? 0) + (guestsRes.count ?? 0);
    if (seats >= capacity) {
      warnings.push(`A aula está cheia (${seats}/${capacity}).`);
    }

    if (profile.weekly_class_limit !== null && !isWaitlisted) {
      // Mirror book_class's weekly count: booked always, waitlisted only
      // while still upcoming.
      const weekStart = mondayOf(instance_date);
      const { data: weekRows } = await admin
        .from("bookings")
        .select("id")
        .eq("user_id", user_id)
        .gte("instance_date", weekStart)
        .lte("instance_date", addDays(weekStart, 6))
        .or(
          `status.eq.booked,and(status.eq.waitlisted,instance_date.gte.${todayLisbon()})`,
        );
      const limit = profile.weekly_class_limit as number;
      if ((weekRows?.length ?? 0) >= limit) {
        warnings.push(
          limit === 1
            ? "Já tem a aula desta semana."
            : `Já tem as ${limit} aulas desta semana.`,
        );
      }
    }

    const { data: sameDay } = await admin
      .from("bookings")
      .select("id")
      .eq("user_id", user_id)
      .eq("instance_date", instance_date)
      .neq("template_id", template_id)
      .in("status", ["booked", "waitlisted"])
      .limit(1);
    if ((sameDay?.length ?? 0) > 0) {
      warnings.push("Já tem outra aula neste dia.");
    }

    if (profile.is_blocked) warnings.push("Está em pausa.");
    if (!profile.approved) warnings.push("Conta ainda não aprovada.");
    if (isWaitlisted) warnings.push("Está em lista de espera — passa a confirmado.");

    if (warnings.length > 0) return { warnings };
  }

  const { error } = await admin.rpc("admin_book_class", {
    p_user_id: user_id,
    p_template_id: template_id,
    p_instance_date: instance_date,
  });
  if (error) {
    if (error.message.includes("BATUS_ALREADY_BOOKED")) {
      return { error: "Já está nesta aula." };
    }
    if (error.message.includes("BATUS_NO_CREDITS")) {
      return { error: "Pack sem aulas. Ajusta o pack na página do aluno." };
    }
    return { error: "Não foi possível adicionar. Tenta de novo." };
  }

  // Tell the student — best-effort, a mail hiccup must never undo a booking.
  // `emailed` feeds the coach's toast, which must only claim what happened.
  let emailed = false;
  try {
    if (profile.email) {
      emailed = await sendCoachAddedEmail({
        to: profile.email,
        studentName: profile.full_name,
        className: template.name,
        dateLabel: formatDayHeader(instance_date),
        timeLabel: formatTime(startTime),
        siteUrl: getSiteUrl(),
      });
    }
  } catch (err) {
    console.error("[calendar] coach-add email failed:", err);
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
  revalidatePath("/perfil");
  return { ok: true, emailed };
}

// Remove ONE student from a class instance — the coach's "ceder vagas" tool.
// A student messages that they can't come; the coach takes them out; the seat
// frees and the first waitlisted student is promoted into it.
//
// This is a deliberate mirror of the student's own cancelBooking
// (app/(public)/aulas/actions.ts): read the booking, do a status-GUARDED flip
// so a double-tap can't run the side-effects twice, then — only when a
// CONFIRMED booking was actually cancelled — refund the pack credit (no-op for
// non-pack; the RPC guards on class_credits) and promote the waitlist. Two
// deliberate differences, both required here:
//   • Service-role client — a student's booking row is outside the coach's RLS
//     reach, so the coach's cookie client couldn't update it.
//   • A PLAIN cancelled_reason (no BATUS_CLASS_CANCELLED marker) — so a later
//     whole-class cancel→restore never resurrects a student the coach removed
//     on purpose (restoreInstanceBookings only revives marker rows).
// No student-style cancellation cutoff (the coach may remove someone right up
// to the start — that's the point), but the class must not have STARTED yet:
// see the already-started guard below.
export async function removeStudentBooking(formData: FormData) {
  await assertAdmin();
  const booking_id = formData.get("booking_id") as string | null;
  if (!booking_id) throw new Error("Pedido inválido.");

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, user_id, template_id, instance_date, status, class_templates!inner(start_time)",
    )
    .eq("id", booking_id)
    .maybeSingle();

  // Already cancelled (or gone) — nothing to undo. Just refresh the view so a
  // stale tab that double-submitted doesn't error.
  if (!booking || booking.status === "cancelled") {
    revalidatePath("/admin/calendar");
    return;
  }

  // This tool only frees FUTURE seats. Once the class has STARTED, refuse:
  // cancelling a past booking would drop the student's lifetime "aulas feitas"
  // streak, refund a pack credit for a class already delivered (a free class
  // minted from nothing), and promote a waitlisted student into a class that is
  // over. Deliberately narrower than the student cutoff — last-minute removal
  // BEFORE the class starts is the whole point of "ceder vagas".
  //
  // Uses the EFFECTIVE start time: if the coach moved this instance with
  // "Adiar", the template still holds the original hour, so gating on it would
  // be wrong by the whole reschedule delta in either direction.
  const startTime = await effectiveStartTime(
    booking.template_id,
    booking.instance_date,
    (booking.class_templates as unknown as { start_time: string }).start_time,
  );
  const classStart = lisbonInstant(booking.instance_date, startTime);
  if (Date.now() >= classStart.getTime()) {
    // Tell the coach, don't just no-op: a × that silently does nothing reads
    // as a broken button and he'll keep tapping it.
    redirect("/admin/calendar?started=1");
  }

  const wasBooked = booking.status === "booked";

  // Guard the flip on the status we read and return the affected row: a
  // concurrent double-submit matches 0 rows on the second run, so only ONE
  // request refunds a credit / promotes below. Without this, two requests
  // could each refund (+1) — a class minted from nothing.
  const { data: updated, error } = await admin
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_reason: "Removido pelo estúdio",
    })
    .eq("id", booking_id)
    .eq("status", booking.status)
    .select("id");
  if (error) throw new Error(error.message);

  const didCancel = (updated?.length ?? 0) > 0;

  // Only a genuinely-cancelled CONFIRMED booking freed a seat: refund the pack
  // credit and promote the first waitlisted student into the vacancy. A
  // waitlisted removal freed nothing and never spent a credit — skip both.
  if (wasBooked && didCancel) {
    await admin.rpc("adjust_class_credits", {
      p_user_id: booking.user_id,
      p_delta: 1,
    });
    await promoteFirstWaitlistedIfSeatFree(
      booking.template_id,
      booking.instance_date,
    );
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/aulas");
  revalidatePath("/perfil");
}
