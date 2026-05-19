-- 0012_atomic_booking.sql
-- Booking race fix.
--
-- The bookClass server action used to (1) count booked seats and (2) insert
-- the booking as two separate steps. Two students grabbing the last seat in
-- the same instant could both pass step 1 and both insert as 'booked',
-- overbooking the class by one. The waitlist position had the same collision.
--
-- book_class() does the whole thing atomically: a transaction-scoped advisory
-- lock keyed on the class instance serializes concurrent bookings for that
-- instance (different instances never block each other), then the count, the
-- booked-vs-waitlisted decision, and the write all happen inside that lock.
-- The bookClass action now calls this instead of doing the steps itself.
--
-- Safe to re-run: create-or-replace + idempotent grants.

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

-- Only the server action (service-role client) may call this. A logged-in
-- student must NOT be able to invoke it directly via the REST API: the
-- approval / blocked checks live in the action, and p_user_id is a parameter.
revoke execute on function public.book_class(uuid, uuid, date, integer) from public;
grant execute on function public.book_class(uuid, uuid, date, integer) to service_role;
