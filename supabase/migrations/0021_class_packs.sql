-- 0021_class_packs.sql
-- Prepaid class packs: a THIRD payment model beside monthly plans and PT.
-- A "pack" student has a balance of prepaid classes (class_credits) and draws
-- it down one booking at a time. No monthly fee, no weekly limit — they're
-- gated purely by their remaining credits.
--
-- Rules are deliberately dumb (there is NO check-in, so the app never judges
-- attendance): booking a confirmed seat spends 1 credit; cancelling in time
-- refunds it (cancelBooking action); waitlisting spends nothing until promotion
-- (waitlist.ts). No-shows / goodwill are the coach adjusting the balance by hand.

-- 1. The balance. null = NOT a pack student (monthly/PT, unchanged behaviour).
--    >= 0 = a pack student with this many classes left.
alter table public.profiles
  add column if not exists class_credits integer
    check (class_credits is null or class_credits >= 0);

-- 2. Protect it like the other admin-only columns — a student can never edit
--    their own balance. (Service role + admins still can.)
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
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
     or (new.weekly_class_limit is distinct from old.weekly_class_limit)
     or (new.class_credits is distinct from old.class_credits) then
    raise exception 'Sem permissão para alterar campos admin do perfil.';
  end if;
  return new;
end;
$$;

-- 3. book_class: a pack student (class_credits not null) spends one credit per
--    CONFIRMED booking. Waitlist spends nothing (the credit is taken later, on
--    promotion, by the app). The profile row is locked FOR UPDATE so two
--    concurrent bookings by the same student — even in different weeks, which
--    the per-week advisory lock does NOT cover — can't overspend the balance.
create or replace function public.book_class(
  p_user_id uuid,
  p_template_id uuid,
  p_instance_date date,
  p_capacity integer
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_week_start date;
  v_limit integer;
  v_credits integer;
  v_week_count integer;
  v_existing_id uuid;
  v_existing_status public.booking_status;
  v_booked integer;
  v_waitlisted integer;
  v_status public.booking_status;
  v_position integer;
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

  if v_existing_status in ('booked', 'waitlisted') then
    raise exception 'BATUS_ALREADY_BOOKED';
  end if;

  if exists (
    select 1 from public.bookings
    where user_id = p_user_id
      and instance_date = p_instance_date
      and template_id <> p_template_id
      and status in ('booked', 'waitlisted')
  ) then
    raise exception 'BATUS_ONE_PER_DAY';
  end if;

  -- Lock the profile row: serializes this student's concurrent bookings so a
  -- pack balance can't be overspent (the week lock only covers one week).
  select weekly_class_limit, class_credits
    into v_limit, v_credits
  from public.profiles
  where id = p_user_id
  for update;

  -- Pack student with an empty balance can't book OR waitlist — you need a
  -- class in the bank to reserve a spot. The credit is only SPENT on a
  -- confirmed booking (below); waitlisting holds a place without spending.
  if v_credits is not null and v_credits <= 0 then
    raise exception 'BATUS_NO_CREDITS';
  end if;

  if v_limit is not null then
    select count(*) into v_week_count
    from public.bookings
    where user_id = p_user_id
      and instance_date >= v_week_start
      and instance_date <= v_week_start + 6
      and (
        status = 'booked'
        or (status = 'waitlisted' and instance_date >= current_date)
      );
    if v_week_count >= v_limit then
      raise exception 'BATUS_WEEKLY_LIMIT';
    end if;
  end if;

  -- Seats taken = confirmed bookings + coach-added guests.
  select
    (select count(*) from public.bookings
      where template_id = p_template_id
        and instance_date = p_instance_date
        and status = 'booked')
    + (select count(*) from public.class_guests
        where template_id = p_template_id
          and instance_date = p_instance_date)
  into v_booked;

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

  if v_credits is not null and v_status = 'booked' then
    update public.profiles
       set class_credits = class_credits - 1
     where id = p_user_id;
  end if;

  return v_status::text;
end;
$$;

revoke execute on function public.book_class(uuid, uuid, date, integer)
  from public, authenticated, anon;
grant execute on function public.book_class(uuid, uuid, date, integer) to service_role;

-- 4. adjust_class_credits: the coach's −1/+1/+5/+10 buttons. Atomic (no
--    read-modify-write race with a concurrent booking), clamped at 0, and a
--    no-op for a non-pack student. Returns the new balance (null if not a pack).
create or replace function public.adjust_class_credits(
  p_user_id uuid,
  p_delta integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new integer;
begin
  update public.profiles
     set class_credits = greatest(0, class_credits + p_delta)
   where id = p_user_id
     and class_credits is not null
   returning class_credits into v_new;
  return v_new;
end;
$$;

revoke execute on function public.adjust_class_credits(uuid, integer)
  from public, authenticated, anon;
grant execute on function public.adjust_class_credits(uuid, integer) to service_role;

-- 5. promote_waitlist: promote the first ELIGIBLE waitlisted student into a
--    freed seat, atomically. Serialized on the SAME advisory-lock key as
--    book_class (template + date), so two near-simultaneous seat-frees each
--    promote a DISTINCT person and can't double-spend a pack credit or leave a
--    seat empty. A pack candidate must successfully spend a credit to take the
--    seat (they didn't when they joined the waitlist); one who ran out while
--    waiting is skipped. Returns the promoted user_id, or null if nobody eligible.
create or replace function public.promote_waitlist(
  p_template_id uuid,
  p_instance_date date,
  p_capacity integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seats integer;
  v_cand record;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_template_id::text),
    hashtext(p_instance_date::text)
  );

  -- Seats taken = confirmed bookings + coach-added guests.
  select
    (select count(*) from public.bookings
      where template_id = p_template_id
        and instance_date = p_instance_date
        and status = 'booked')
    + (select count(*) from public.class_guests
        where template_id = p_template_id
          and instance_date = p_instance_date)
  into v_seats;

  if v_seats >= p_capacity then
    return null; -- still full (e.g. coach overfilled) — nothing to promote
  end if;

  -- Walk the queue in order; promote the first eligible. A pack candidate pays
  -- a credit here (they didn't when they joined the waitlist); skip if empty.
  for v_cand in
    select b.id, b.user_id, p.class_credits
    from public.bookings b
    join public.profiles p on p.id = b.user_id
    where b.template_id = p_template_id
      and b.instance_date = p_instance_date
      and b.status = 'waitlisted'
    order by b.waitlist_position asc
  loop
    if v_cand.class_credits is not null then
      update public.profiles
         set class_credits = class_credits - 1
       where id = v_cand.user_id
         and class_credits > 0;
      if not found then
        continue; -- ran out of classes while waiting — try the next in line
      end if;
    end if;

    update public.bookings
       set status = 'booked', waitlist_position = null
     where id = v_cand.id
       and status = 'waitlisted';
    if not found then
      -- A concurrent cancel stole this row (it is no longer waitlisted). Refund
      -- the credit we just spent (pack candidate) so it isn't leaked, and move
      -- on to the next person in line.
      if v_cand.class_credits is not null then
        update public.profiles
           set class_credits = class_credits + 1
         where id = v_cand.user_id;
      end if;
      continue;
    end if;
    return v_cand.user_id;
  end loop;

  return null; -- everyone left in line is a pack student with no classes
end;
$$;

revoke execute on function public.promote_waitlist(uuid, date, integer)
  from public, authenticated, anon;
grant execute on function public.promote_waitlist(uuid, date, integer) to service_role;
