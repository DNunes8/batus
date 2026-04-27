-- 0004_merch.sql
-- Light merch store: claim-and-pay-in-person, no payment processing.
-- Stock is decremented when a claim is created and restored when cancelled.

create type merch_claim_status as enum ('pending', 'fulfilled', 'cancelled');

-- ============================================================================
-- TABLES
-- ============================================================================

create table public.merch_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  stock integer not null check (stock >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.merch_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.merch_items(id) on delete restrict,
  quantity smallint not null default 1 check (quantity > 0),
  status merch_claim_status not null default 'pending',
  claimed_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  notes text
);

create index merch_claims_status_idx
  on public.merch_claims (status, claimed_at desc);

create index merch_claims_user_idx
  on public.merch_claims (user_id, claimed_at desc);

create trigger merch_items_updated_at before update on public.merch_items
  for each row execute procedure public.touch_updated_at();

-- ============================================================================
-- ATOMIC CLAIM/CANCEL/FULFILL VIA RPC
-- These run with security definer + a row lock to handle concurrent claims
-- without overselling stock.
-- ============================================================================

create or replace function public.claim_merch(
  p_item_id uuid,
  p_quantity smallint default 1
)
returns uuid language plpgsql security definer as $$
declare
  v_claim_id uuid;
  v_stock integer;
  v_active boolean;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Tens de iniciar sessão.';
  end if;

  if exists (select 1 from public.profiles where id = v_user and is_blocked) then
    raise exception 'A tua conta está bloqueada.';
  end if;

  -- Lock the row for the duration of this transaction
  select stock, is_active into v_stock, v_active
    from public.merch_items
    where id = p_item_id
    for update;

  if not found then
    raise exception 'Item não encontrado.';
  end if;

  if not v_active then
    raise exception 'Item indisponível.';
  end if;

  if v_stock < p_quantity then
    raise exception 'Sem stock disponível.';
  end if;

  insert into public.merch_claims (user_id, item_id, quantity)
  values (v_user, p_item_id, p_quantity)
  returning id into v_claim_id;

  update public.merch_items
    set stock = stock - p_quantity
    where id = p_item_id;

  return v_claim_id;
end;
$$;

create or replace function public.cancel_merch_claim(p_claim_id uuid)
returns void language plpgsql security definer as $$
declare
  v_claim record;
begin
  select * into v_claim from public.merch_claims where id = p_claim_id for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_claim.status <> 'pending' then
    raise exception 'Pedido já foi processado.';
  end if;

  if not public.is_admin() and v_claim.user_id <> auth.uid() then
    raise exception 'Sem permissão.';
  end if;

  update public.merch_claims set status = 'cancelled' where id = p_claim_id;
  update public.merch_items
    set stock = stock + v_claim.quantity
    where id = v_claim.item_id;
end;
$$;

create or replace function public.fulfill_merch_claim(p_claim_id uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas admin pode marcar como entregue.';
  end if;

  update public.merch_claims
    set status = 'fulfilled', fulfilled_at = now()
    where id = p_claim_id and status = 'pending';

  if not found then
    raise exception 'Pedido não está pendente.';
  end if;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.merch_items enable row level security;
alter table public.merch_claims enable row level security;

-- Items: anyone can read active items (or admin sees all). Only admin writes.
create policy "merch_items_public_read" on public.merch_items
  for select using (is_active or public.is_admin());

create policy "merch_items_admin_write" on public.merch_items
  for all using (public.is_admin()) with check (public.is_admin());

-- Claims: users see/cancel their own (via RPC), admin sees all and manages all.
-- Direct INSERT/UPDATE blocked at RLS — users must go through the RPCs above.
create policy "merch_claims_select_own_or_admin" on public.merch_claims
  for select using (auth.uid() = user_id or public.is_admin());

create policy "merch_claims_admin_write" on public.merch_claims
  for all using (public.is_admin()) with check (public.is_admin());
