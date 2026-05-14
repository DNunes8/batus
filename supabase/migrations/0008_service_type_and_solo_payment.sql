-- 0008_service_type_and_solo_payment.sql
-- Splits students by service type (group class vs 1:1) so /admin/pagamentos
-- can tab between them, and lets 1:1 students opt out of monthly payment
-- tracking (cash-on-session is the alternative pattern).

-- ============================================================================
-- 1. Service type: which Pagamentos tab a student belongs to
--    'group' → "Aulas de grupo" tab (default). Always pays monthly.
--    'solo'  → "1:1s" tab. May or may not pay monthly (see has_monthly_fee).
-- ============================================================================
alter table public.profiles
  add column if not exists service_type text not null default 'group'
    check (service_type in ('group', 'solo'));

-- ============================================================================
-- 2. has_monthly_fee: only meaningful for service_type='solo'.
--    true  → student pays a fixed monthly amount (bulk pre-pay, monthly
--            invoice, 10-pack expressed as monthly, etc). Coach tracks
--            their Pago / Por pagar / Em pausa status like a mensalista.
--    false → student pays per session, cash on the day. No monthly tracking,
--            no payment_record needed. Coach just sees session activity.
--    Default true so existing students aren't quietly turned off; group
--    students inherit this naturally since they always pay monthly.
-- ============================================================================
alter table public.profiles
  add column if not exists has_monthly_fee boolean not null default true;
