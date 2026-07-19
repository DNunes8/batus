-- 0020_class_guests.sql
-- "Aula experimental" / manual placement: the coach adds a person BY NAME to a
-- specific class instance from the admin calendar — no account needed. The
-- guest occupies a real seat: students see the count go up, and book_class
-- counts guests toward capacity so nobody books a seat the coach gave away.
-- The coach can always add a guest, even past capacity (his call, his room).
--
-- Doubles as the trial-people history: every row keeps name + class + date,
-- surfaced on the Alunos page ("Aulas experimentais") as a follow-up list.

create table if not exists public.class_guests (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.class_templates(id) on delete cascade,
  instance_date date not null,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create index if not exists class_guests_instance_idx
  on public.class_guests (template_id, instance_date);

alter table public.class_guests enable row level security;

-- Coach-only data (students only ever see the aggregated seat count, which the
-- server renders). Service role bypasses RLS for the schedule counts.
drop policy if exists "class_guests_admin_all" on public.class_guests;
create policy "class_guests_admin_all" on public.class_guests
  for all using (public.is_admin()) with check (public.is_admin());

-- book_class: guests now count toward capacity. Everything else (week lock,
-- one-per-day, weekly limit, waitlist, reactivation) is unchanged from 0019.
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

  return v_status::text;
end;
$$;

revoke execute on function public.book_class(uuid, uuid, date, integer) from public;
grant execute on function public.book_class(uuid, uuid, date, integer) to service_role;
