-- 0013_solo_presets.sql
-- PT templates can now be "presets": reusable models that do NOT auto-render
-- on the calendar. The coach taps a preset in the calendar's add-picker to
-- drop a PT onto a chosen day — nothing appears on its own.
--
-- A non-preset row keeps behaving exactly as before:
--   • recurring  (active_until IS NULL)            → auto-renders every week
--   • one-off    (active_from = active_until = day) → renders that single day
--
-- Default FALSE means every existing row is unchanged by this migration.

alter table public.solo_session_templates
  add column if not exists is_preset boolean not null default false;
