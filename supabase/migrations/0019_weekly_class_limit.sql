-- 0019_weekly_class_limit.sql
-- Plan tiers (coach's pricing): 25€ → 1 aula/semana, 35€ → 2, 50€ → 3,
-- 60€ → livre. profiles.weekly_class_limit holds the number; NULL = livre
-- (unlimited). Default NULL so existing students keep current behavior until
-- the coach assigns each tier from the drawer / student page.
--
-- Enforcement lives in book_class so it is atomic: the per-user advisory lock
-- now covers the whole ISO week (Mon-Sun) — which also still serializes
-- same-day attempts, so the one-per-day check keeps its guarantee too.
--
-- Waitlist semantics: a waitlisted spot holds a weekly slot only while its
-- class is still UPCOMING (you're in line for a seat; cancel it to free the
-- slot). Once the class date passes without promotion it stops counting —
-- a student must never lose a week to a class they never got into. Booked
-- rows always count (past ones = classes attended this week).

alter table public.profiles
  add column if not exists weekly_class_limit integer
  check (weekly_class_limit is null or weekly_class_limit between 1 and 7);

-- Coach-only column: extend the protection trigger so a student can't raise
-- their own limit via a direct PostgREST PATCH (same hole class as 0017).
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if (new.is_admin is distinct from old.is_admin)
     or (new.is_blocked is distinct from old.is_blocked)
     or (new.notes is distinct from old.notes)
     or (new.approved is distinct from old.approved)
     or (new.has_monthly_fee is distinct from old.has_monthly_fee)
     or (new.monthly_fee_cents is distinct from old.monthly_fee_cents)
     or (new.service_type is distinct from old.service_type)
     or (new.weekly_class_limit is distinct from old.weekly_class_limit) then
    raise exception 'Sem permissão para alterar campos admin do perfil.';
  end if;
  return new;
end;
$$;

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
  v_week_start date;
  v_limit integer;
  v_week_count integer;
  v_existing_id uuid;
  v_existing_status public.booking_status;
  v_booked integer;
  v_waitlisted integer;
  v_status public.booking_status;
  v_position integer;
begin
  -- Monday of the instance's ISO week.
  v_week_start := p_instance_date
    - (extract(isodow from p_instance_date)::integer - 1);

  -- Per-(user, week) lock FIRST (covers the weekly-limit AND one-per-day
  -- checks — same week implies same lock), then the per-instance lock.
  -- Consistent ordering on every call: no deadlock.
  perform pg_advisory_xact_lock(
    hashtext('batus_user_week'),
    hashtext(p_user_id::text || '|' || v_week_start::text)
  );
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

  -- One class per day: reject if this student already has an active booking
  -- for a DIFFERENT class on this date.
  if exists (
    select 1 from public.bookings
    where user_id = p_user_id
      and instance_date = p_instance_date
      and template_id <> p_template_id
      and status in ('booked', 'waitlisted')
  ) then
    raise exception 'BATUS_ONE_PER_DAY';
  end if;

  -- Weekly plan limit (NULL = livre). Active bookings Mon-Sun of this week.
  select weekly_class_limit into v_limit
  from public.profiles
  where id = p_user_id;

  if v_limit is not null then
    select count(*) into v_week_count
    from public.bookings
    where user_id = p_user_id
      and instance_date >= v_week_start
      and instance_date <= v_week_start + 6
      and (
        status = 'booked'
        -- Waitlisted only holds a slot while the class is still upcoming.
        or (status = 'waitlisted' and instance_date >= current_date)
      );
    if v_week_count >= v_limit then
      raise exception 'BATUS_WEEKLY_LIMIT';
    end if;
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
