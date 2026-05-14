-- 0007_payment_status_and_fees.sql
-- Adds three-state status to payment_records (paid / unpaid / paused),
-- a per-student fee override, and a default monthly fee setting.
-- Backwards compatible: old paid_at-based code still works during transition.

-- ============================================================================
-- 1. Default monthly fee setting (€40 default — coach can change in UI)
-- ============================================================================
insert into public.settings (key, value) values
  ('default_monthly_fee_cents', '4000'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- 2. Per-student fee override on profiles
--    null  → fall back to the studio default above
--    not null → this student pays this specific amount
-- ============================================================================
alter table public.profiles
  add column if not exists monthly_fee_cents integer
    check (monthly_fee_cents is null or monthly_fee_cents >= 0);

-- ============================================================================
-- 3. Three-state status on payment_records
--    'paid'   → paid_at set, counts in earnings
--    'unpaid' → owed but not paid yet (default for new rows)
--    'paused' → student on break this month, no payment expected
-- ============================================================================
alter table public.payment_records
  add column if not exists status text not null default 'unpaid'
    check (status in ('paid', 'unpaid', 'paused'));

-- Backfill existing rows: anything with paid_at is paid; rest stays 'unpaid'.
update public.payment_records
  set status = 'paid'
  where paid_at is not null
    and status = 'unpaid';

-- Index for the "show me everyone's status for month X" query on /admin/pagamentos
create index if not exists payment_records_month_idx
  on public.payment_records (month);
