-- 0014_birthday.sql
-- Date of birth on student profiles. Surfaces on the admin dashboard the day
-- of the birthday so the coach can wish the student in the team WhatsApp.
--
-- Nullable: existing rows get NULL and the "complete your profile" gate
-- prompts them to fill it in on next interaction (same pattern as the
-- name/phone enforcement). No backfill needed.

alter table public.profiles
  add column if not exists birthday date;
