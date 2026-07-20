-- 0022_finance_entries.sql
-- The manual half of the Finanças page: expenses (renda, material, contas) and
-- "outras receitas" not captured automatically (vendas de packs, one-offs).
--
-- Auto revenue — mensalidades (payment_records), PTs (solo_sessions +
-- recurring templates), loja (merch_claims) — is NEVER copied here. The Finanças
-- page SUMS it live from the tables that already own it, so nothing lives in two
-- places. This table only holds what the coach types by hand.
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense')),
  category text not null check (char_length(category) between 1 and 60),
  amount_cents integer not null check (amount_cents >= 0),
  entry_date date not null,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists finance_entries_date_idx
  on public.finance_entries (entry_date);

alter table public.finance_entries enable row level security;

-- Admin-only: money data is the coach's, never exposed to students.
drop policy if exists "finance_entries_admin_all" on public.finance_entries;
create policy "finance_entries_admin_all" on public.finance_entries
  for all using (public.is_admin()) with check (public.is_admin());
