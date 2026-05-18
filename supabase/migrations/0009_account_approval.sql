-- 0009_account_approval.sql
-- New students must be approved by the coach before they can book classes.
-- A fresh signup lands pending; the coach approves from /admin/students.

-- Add the column with default TRUE so every account that already exists is
-- grandfathered in — nobody currently using the app gets locked out...
alter table public.profiles
  add column if not exists approved boolean not null default true;

-- ...then flip the default to FALSE so every NEW signup lands pending.
-- (Two steps instead of a backfill UPDATE keeps this migration safe to
-- re-run: a second run won't re-approve students who signed up since.)
alter table public.profiles
  alter column approved set default false;

-- Extend the column-protection trigger (from migration 0003) so a non-admin
-- can't flip their own `approved` flag via a direct API call. Admins — and
-- the service role — still pass through untouched, which is how the coach
-- approves students. The trigger itself already exists; replacing the
-- function body is enough.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer as $$
begin
  -- Allow admins (or service role bypassing RLS) to update everything.
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  -- For everyone else: any change to admin-only columns is rejected.
  if (new.is_admin is distinct from old.is_admin)
     or (new.is_blocked is distinct from old.is_blocked)
     or (new.notes is distinct from old.notes)
     or (new.approved is distinct from old.approved) then
    raise exception 'Sem permissão para alterar campos admin do perfil.';
  end if;

  return new;
end;
$$;
