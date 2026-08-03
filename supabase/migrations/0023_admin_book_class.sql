-- 0023_admin_book_class.sql
-- The coach's force-add: put a NAMED student into a class instance as a real
-- confirmed booking, on the coach's authority. Unlike book_class (the student
-- path), this deliberately SKIPS capacity, the weekly plan limit and the
-- one-class-per-day rule — those are surfaced as informational warnings in the
-- admin UI before this is called, and the coach's confirm IS the override.
--
-- What it must NOT skip is the money guard: a pack student with an empty
-- balance cannot be force-booked (BATUS_NO_CREDITS) — the coach tops the pack
-- up first, so the books stay honest. A confirmed force-add spends 1 credit
-- exactly like a normal booking.
--
-- Race-safety mirrors book_class verbatim: the same two advisory locks in the
-- SAME ORDER (user-week first, then class-instance) so a force-add can never
-- deadlock or interleave with a concurrent student booking / waitlist
-- promotion, and the profile row is locked FOR UPDATE so a pack balance can't
-- be overspent across weeks.
--
-- Row states handled:
--   · booked      -> BATUS_ALREADY_BOOKED (nothing to force)
--   · waitlisted  -> promoted to booked (credit spent now — a waitlisted pack
--                    student had NOT yet paid, same as promote_waitlist)
--   · cancelled   -> the old row is revived as booked
--   · none        -> a fresh booked row is inserted
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
  v_cancelled_reason text;
  v_charge boolean := true;
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

  select id, status, cancelled_reason
    into v_existing_id, v_existing_status, v_cancelled_reason
  from public.bookings
  where user_id = p_user_id
    and template_id = p_template_id
    and instance_date = p_instance_date;

  if v_existing_status = 'booked' then
    raise exception 'BATUS_ALREADY_BOOKED';
  end if;

  -- Does this add owe a credit? Almost always yes — EXCEPT when reviving a
  -- row whose spent credit is still PARKED in it: a studio cancel
  -- (cancelInstanceBookings) flips booked->cancelled WITHOUT refunding,
  -- because a restore puts the student back for free. Those rows carry the
  -- BATUS_CLASS_CANCELLED:booked marker — or, if a restore skipped the
  -- student, the stripped 'Aula cancelada pelo estúdio' reason. Charging
  -- again on revive would make the student pay twice for one class. Every
  -- other cancelled row is settled (self-cancel and coach-remove refund;
  -- waitlisted rows never paid) and pays normally.
  if v_existing_status = 'cancelled' and (
       v_cancelled_reason like 'BATUS_CLASS_CANCELLED:booked%'
       or v_cancelled_reason = 'Aula cancelada pelo estúdio'
     ) then
    v_charge := false;
  end if;

  -- Lock the profile row: serializes this student's concurrent bookings so a
  -- pack balance can't be overspent (the week lock only covers one week).
  select class_credits
    into v_credits
  from public.profiles
  where id = p_user_id
  for update;

  -- The one guard the coach cannot override: an empty pack. A fresh add and a
  -- waitlisted->booked promotion both SPEND a credit, so both need one. A
  -- parked-credit revive already paid — a 0-balance student reclaiming their
  -- own seat must not be blocked.
  if v_credits is not null and v_credits <= 0 and v_charge then
    raise exception 'BATUS_NO_CREDITS';
  end if;

  if v_existing_id is not null then
    -- Waitlisted -> booked, or reviving a cancelled row. Either way the seat
    -- becomes confirmed now.
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

  if v_credits is not null and v_charge then
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
