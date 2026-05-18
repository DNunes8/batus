-- 0011_settings_read_scope.sql
-- The public-read policy on `settings` exposed every row to anyone — including
-- default_monthly_fee_cents (the studio's pricing). Scope it down: the only
-- settings key a non-admin client needs to read is the cancellation cutoff
-- (read server-side by the cancelBooking action). Everything else is admin-only.

drop policy if exists "settings_public_read" on public.settings;

create policy "settings_read" on public.settings
  for select using (
    key = 'cancellation_cutoff_hours' or public.is_admin()
  );
