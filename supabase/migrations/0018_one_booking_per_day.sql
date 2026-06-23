-- 0018_one_booking_per_day.sql
-- Business rule (added by coach Baltaru): a student may hold at most ONE active
-- booking (booked or waitlisted) per calendar day — they can't sign up for two
-- classes on the same day.
--
-- Enforced inside book_class so it is atomic: a per-(user, day) advisory lock
-- serializes a student's concurrent attempts to grab two different classes on
-- the same day (the existing per-(template, day) lock only covers one class, so
-- it can't catch this on its own). The user-day lock is taken FIRST and the
-- template-day lock SECOND, in that order on every call, so there is no deadlock.
--
-- Re-booking the SAME class after cancelling still works (the check excludes the
-- current template and only counts active rows). Existing same-day double
-- bookings, if any predate this rule, are left untouched — only NEW second
-- bookings are blocked.
--
-- Safe to re-run: create-or-replace.

create or replace function public.book_class(
  p_user_id uuid,
  p_template_id uuid,
  p_instance_date date,
  p_capacity integer
)
returns text
language plpgsql
security definer
as $$
declare
  v_existing_id uuid;
  v_existing_status public.booking_status;
  v_booked integer;
  v_waitlisted integer;
  v_status public.booking_status;
  v_position integer;
begin
  -- One-per-day lock FIRST (consistent ordering avoids deadlock with the
  -- per-instance lock below). Serializes this student's same-day attempts.
  perform pg_advisory_xact_lock(
    hashtext('batus_user_day'),
    hashtext(p_user_id::text || '|' || p_instance_date::text)
  );

  -- Serialize every booking attempt for THIS class instance. Different
  -- instances never block each other. Released when the function returns.
  perform pg_advisory_xact_lock(
    hashtext(p_template_id::text),
    hashtext(p_instance_date::text)
  );

  -- Does this student already have a row for this instance?
  select id, status
    into v_existing_id, v_existing_status
  from public.bookings
  where user_id = p_user_id
    and template_id = p_template_id
    and instance_date = p_instance_date;

  if v_existing_status in ('booked', 'waitlisted') then
    raise exception 'BATUS_ALREADY_BOOKED';
  end if;

  -- One class per day: reject if this student already has an active booking for
  -- a DIFFERENT class on this date.
  if exists (
    select 1 from public.bookings
    where user_id = p_user_id
      and instance_date = p_instance_date
      and template_id <> p_template_id
      and status in ('booked', 'waitlisted')
  ) then
    raise exception 'BATUS_ONE_PER_DAY';
  end if;

  -- Count confirmed seats and decide: booked, or waitlisted.
  select count(*) into v_booked
  from public.bookings
  where template_id = p_template_id
    and instance_date = p_instance_date
    and status = 'booked';

  if v_booked < p_capacity then
    v_status := 'booked';
    v_position := null;
  else
    select count(*) into v_waitlisted
    from public.bookings
    where template_id = p_template_id
      and instance_date = p_instance_date
      and status = 'waitlisted';
    v_status := 'waitlisted';
    v_position := v_waitlisted + 1;
  end if;

  -- Reactivate a previously cancelled row, or insert a fresh booking.
  if v_existing_id is not null then
    update public.bookings
       set status = v_status,
           waitlist_position = v_position,
           cancelled_at = null,
           cancelled_reason = null,
           booked_at = now()
     where id = v_existing_id;
  else
    insert into public.bookings
      (user_id, template_id, instance_date, status, waitlist_position)
    values
      (p_user_id, p_template_id, p_instance_date, v_status, v_position);
  end if;

  return v_status::text;
end;
$$;

revoke execute on function public.book_class(uuid, uuid, date, integer) from public;
grant execute on function public.book_class(uuid, uuid, date, integer) to service_role;
