-- 0006_solo_recurring.sql
-- Recurring 1:1 sessions on the calendar.
-- solo_session_templates is the recurring schedule (e.g. "Diogo, every
-- Tuesday 19:00, €25, 60 min"). solo_session_overrides handles per-instance
-- changes — cancel one Tuesday without killing the series, or move just
-- that instance to a different time.
--
-- One-off 1:1s still live in the existing public.solo_sessions table —
-- those are unchanged; templates are the addition.

create table public.solo_session_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  student_name text,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  duration_minutes smallint not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  notes text,
  active_from date not null,
  active_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or student_name is not null)
);

create table public.solo_session_overrides (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.solo_session_templates(id) on delete cascade,
  instance_date date not null,
  cancelled boolean not null default false,
  override_start_time time,
  override_duration_minutes smallint,
  reason text,
  created_at timestamptz not null default now(),
  unique (template_id, instance_date)
);

create trigger solo_session_templates_updated_at before update on public.solo_session_templates
  for each row execute procedure public.touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.solo_session_templates enable row level security;
alter table public.solo_session_overrides enable row level security;

-- Admin: full access to manage 1:1 series.
create policy "solo_session_templates_admin_all" on public.solo_session_templates
  for all using (public.is_admin()) with check (public.is_admin());

create policy "solo_session_overrides_admin_all" on public.solo_session_overrides
  for all using (public.is_admin()) with check (public.is_admin());

-- Student can see their OWN recurring 1:1s — so they know they have a
-- standing slot. They can't see anyone else's, and they can't modify.
create policy "solo_session_templates_select_own" on public.solo_session_templates
  for select using (auth.uid() = user_id);

create policy "solo_session_overrides_select_via_template" on public.solo_session_overrides
  for select using (
    exists (
      select 1 from public.solo_session_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );
