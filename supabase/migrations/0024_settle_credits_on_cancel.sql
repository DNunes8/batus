-- 0024_settle_credits_on_cancel.sql
-- The pack-credit model changes from "park the credit" to "settle it now".
--
-- BEFORE: when the studio cancelled a class, the student's spent credit stayed
-- "parked" inside the cancelled booking row, on the theory that restoring the
-- class would put them back for free. If the restore skipped them (they had
-- booked a replacement that day, or hit their weekly cap) the credit was gone
-- permanently, invisibly, with no way for the coach to find out who to
-- compensate. admin_book_class carried a v_charge carve-out to avoid charging
-- twice on such a row.
--
-- NOW: cancelInstanceBookings refunds the credit immediately (see
-- src/app/admin/calendar/actions.ts) and restoreInstanceBookings charges it
-- again when it genuinely puts the student back. No booking row ever carries
-- an unsettled credit, so reviving one must charge normally — the carve-out
-- would now hand out a free class.
--
-- ORDERING CONTRACT (matters): apply this ONLY together with the matching app
-- build, and do not cancel/restore a class or force-add a student in between.
-- With 0024 applied but the old code serving, a cancel would not refund while a
-- re-add would charge — the student pays twice. With the new code serving but
-- 0024 not applied, a cancel refunds and a coach re-add would not charge — a
-- free class. Verified on 2026-08-31 that zero pack students have any
-- studio-cancelled booking, so the exposure during the switch is nil today.

-- Charge exactly one pack credit, and say whether it actually happened.
-- adjust_class_credits clamps at zero (greatest(0, ...)), so charging an empty
-- balance is a silent no-op that looks identical to success — which would hand
-- out a free class every time a restore raced the student spending their last
-- credit. This one refuses instead of clamping, and returns false so the caller
-- can decline to restore the seat. Mirrors the conditional spend already used
-- inside promote_waitlist.
create or replace function public.charge_class_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
     set class_credits = class_credits - 1
   where id = p_user_id
     and class_credits is not null
     and class_credits > 0;
  return found;
end;
$$;

revoke execute on function public.charge_class_credit(uuid)
  from public, authenticated, anon;
grant execute on function public.charge_class_credit(uuid) to service_role;
create or replace function public.admin_book_class(
  p_user_id uuid,
  p_template_id uuid,
  p_instance_date date
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_week_start date;
  v_credits integer;
  v_existing_id uuid;
  v_existing_status public.booking_status;
begin
  v_week_start := p_instance_date
    - (extract(isodow from p_instance_date)::integer - 1);

  perform pg_advisory_xact_lock(
    hashtext('batus_user_week'),
    hashtext(p_user_id::text || '|' || v_week_start::text)
  );
  perform pg_advisory_xact_lock(
    hashtext(p_template_id::text),
    hashtext(p_instance_date::text)
  );

  select id, status
    into v_existing_id, v_existing_status
  from public.bookings
  where user_id = p_user_id
    and template_id = p_template_id
    and instance_date = p_instance_date;

  if v_existing_status = 'booked' then
    raise exception 'BATUS_ALREADY_BOOKED';
  end if;

  -- Lock the profile row: serializes this student's concurrent bookings so a
  -- pack balance can't be overspent (the week lock only covers one week).
  select class_credits
    into v_credits
  from public.profiles
  where id = p_user_id
  for update;

  -- The one guard the coach cannot override: an empty pack. Every path here
  -- spends a credit now — a fresh add, a waitlisted->booked promotion, and a
  -- revive of a cancelled row (whose credit was already refunded).
  if v_credits is not null and v_credits <= 0 then
    raise exception 'BATUS_NO_CREDITS';
  end if;

  if v_existing_id is not null then
    update public.bookings
       set status = 'booked',
           waitlist_position = null,
           cancelled_at = null,
           cancelled_reason = null,
           booked_at = now()
     where id = v_existing_id;
  else
    insert into public.bookings
      (user_id, template_id, instance_date, status, waitlist_position)
    values
      (p_user_id, p_template_id, p_instance_date, 'booked', null);
  end if;

  if v_credits is not null then
    update public.profiles
       set class_credits = class_credits - 1
     where id = p_user_id;
  end if;

  return 'booked';
end;
$$;

revoke execute on function public.admin_book_class(uuid, uuid, date)
  from public, authenticated, anon;
grant execute on function public.admin_book_class(uuid, uuid, date) to service_role;
