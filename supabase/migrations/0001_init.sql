-- 0001_init.sql
-- Initial schema for Batus booking app.
-- Apply via Supabase SQL Editor (Project -> SQL Editor -> New Query -> paste -> Run)
-- or via `supabase db push` if the CLI is set up.

-- ============================================================================
-- ENUMS
-- ============================================================================

create type booking_status as enum (
  'booked',
  'cancelled',
  'attended',
  'no_show',
  'waitlisted'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- profiles: extends auth.users with app-specific fields.
-- A row is created automatically by a trigger when a user signs up.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  is_admin boolean not null default false,
  is_blocked boolean not null default false,
  notes text,
  goals text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- class_templates: recurring class definitions.
-- Concrete instances are computed on-the-fly from these + overrides + closed_days.
create table public.class_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  duration_minutes smallint not null check (duration_minutes > 0),
  capacity smallint not null check (capacity > 0),
  active_from date not null,
  active_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- class_overrides: per-instance edits. Lets the coach cancel or reschedule
-- a single occurrence without affecting the template.
create table public.class_overrides (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.class_templates(id) on delete cascade,
  instance_date date not null,
  cancelled boolean not null default false,
  override_start_time time,
  override_duration_minutes smallint,
  override_capacity smallint,
  reason text,
  created_at timestamptz not null default now(),
  unique (template_id, instance_date)
);

-- closed_days: whole-studio closures (holidays, sickness, etc).
create table public.closed_days (
  date date primary key,
  reason text not null,
  created_at timestamptz not null default now()
);

-- bookings: a student's reservation for a specific class instance.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.class_templates(id) on delete cascade,
  instance_date date not null,
  status booking_status not null default 'booked',
  waitlist_position smallint,
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_reason text,
  unique (user_id, template_id, instance_date)
);

create index bookings_template_date_idx
  on public.bookings (template_id, instance_date)
  where status in ('booked', 'waitlisted');

-- solo_sessions: 1:1s the coach manages directly.
-- user_id is nullable for off-app students (just type a name + price).
create table public.solo_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  student_name text,
  session_date timestamptz not null,
  duration_minutes smallint not null,
  price_cents integer not null check (price_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  check (user_id is not null or student_name is not null)
);

-- payment_records: monthly payment tracking per student.
-- Earnings dashboard sums these + solo_sessions.price_cents.
create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  amount_cents integer not null check (amount_cents >= 0),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

-- settings: simple key-value store for studio config.
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('cancellation_cutoff_hours', '4'::jsonb),
  ('default_class_capacity', '12'::jsonb);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update `updated_at` on row updates.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.touch_updated_at();

create trigger class_templates_updated_at before update on public.class_templates
  for each row execute procedure public.touch_updated_at();

create trigger settings_updated_at before update on public.settings
  for each row execute procedure public.touch_updated_at();

-- Auto-create a public.profiles row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- HELPERS
-- ============================================================================

create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles         enable row level security;
alter table public.class_templates  enable row level security;
alter table public.class_overrides  enable row level security;
alter table public.closed_days      enable row level security;
alter table public.bookings         enable row level security;
alter table public.solo_sessions    enable row level security;
alter table public.payment_records  enable row level security;
alter table public.settings         enable row level security;

-- profiles: users see/edit their own row; admin sees all.
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

create policy "profiles_admin_insert" on public.profiles
  for insert with check (public.is_admin());

-- class_templates: anyone can read (public schedule); admin writes.
create policy "class_templates_public_read" on public.class_templates
  for select using (true);

create policy "class_templates_admin_write" on public.class_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- class_overrides: anyone reads (for accurate schedule rendering); admin writes.
create policy "class_overrides_public_read" on public.class_overrides
  for select using (true);

create policy "class_overrides_admin_write" on public.class_overrides
  for all using (public.is_admin()) with check (public.is_admin());

-- closed_days: anyone reads (for the public calendar); admin writes.
create policy "closed_days_public_read" on public.closed_days
  for select using (true);

create policy "closed_days_admin_write" on public.closed_days
  for all using (public.is_admin()) with check (public.is_admin());

-- bookings: users manage their own; admin sees and manages all.
create policy "bookings_select_own_or_admin" on public.bookings
  for select using (auth.uid() = user_id or public.is_admin());

create policy "bookings_insert_own" on public.bookings
  for insert with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_blocked
    )
  );

create policy "bookings_update_own_or_admin" on public.bookings
  for update using (auth.uid() = user_id or public.is_admin());

create policy "bookings_admin_delete" on public.bookings
  for delete using (public.is_admin());

-- solo_sessions: admin only — it's the coach's manual entry tool.
create policy "solo_sessions_admin_all" on public.solo_sessions
  for all using (public.is_admin()) with check (public.is_admin());

-- payment_records: users see their own; admin manages all.
create policy "payment_records_select_own_or_admin" on public.payment_records
  for select using (auth.uid() = user_id or public.is_admin());

create policy "payment_records_admin_write" on public.payment_records
  for all using (public.is_admin()) with check (public.is_admin());

-- settings: anyone reads (cancellation cutoff is needed by booking UI); admin writes.
create policy "settings_public_read" on public.settings
  for select using (true);

create policy "settings_admin_write" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());
