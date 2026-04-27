-- 0002_contact_messages.sql
-- Stores submissions from the public /contacto form.
-- Anyone can insert (it's a public contact form); only admins can read/manage.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  notes text
);

create index contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

create policy "contact_messages_public_insert" on public.contact_messages
  for insert with check (true);

create policy "contact_messages_admin_select" on public.contact_messages
  for select using (public.is_admin());

create policy "contact_messages_admin_update" on public.contact_messages
  for update using (public.is_admin()) with check (public.is_admin());

create policy "contact_messages_admin_delete" on public.contact_messages
  for delete using (public.is_admin());
