-- 0005_class_visibility.sql
-- Add a public/members-only visibility flag to class_templates so the
-- public schedule (/aulas) can show only public classes to anonymous
-- visitors, while logged-in students still see private "members"
-- classes. Admins always see everything (via the admin client).

alter table public.class_templates
  add column if not exists is_public boolean not null default true;

-- Replace the public-read policy: anonymous can read only is_public,
-- logged-in users can read everything (they're "members"), admin keeps
-- full access (covered by the existing admin-write policy + the OR auth.uid()).
drop policy if exists "class_templates_public_read" on public.class_templates;

create policy "class_templates_public_read" on public.class_templates
  for select using (is_public or auth.uid() is not null);
