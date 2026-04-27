-- 0003_profile_protection.sql
-- Lock down sensitive profile columns so non-admin users can't promote
-- themselves or hide their is_blocked flag via direct API calls.
-- Profiles RLS allows users to UPDATE their own row, which is fine for
-- name/phone/goals — but not for is_admin / is_blocked / notes.

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
     or (new.notes is distinct from old.notes) then
    raise exception 'Sem permissão para alterar campos admin do perfil.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute procedure public.protect_profile_columns();
