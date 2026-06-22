-- 0017_protect_fee_columns.sql
-- Close a profile-update authorization hole found in the launch audit.
--
-- profiles_update_own_or_admin (0001) lets a user UPDATE their own row, and the
-- column-protection trigger (0009) only rejected is_admin/is_blocked/notes/
-- approved. The fee columns were NOT guarded — so a logged-in student could
-- PATCH /rest/v1/profiles?id=eq.<own-id> {"has_monthly_fee": false} (the anon
-- key is public) and permanently bypass the unpaid-booking gate
-- (isUnpaidAndBlocked returns false the moment has_monthly_fee is false), or
-- corrupt monthly_fee_cents / service_type. These are coach-only fields.
--
-- Fix: add has_monthly_fee, monthly_fee_cents, service_type to the trigger's
-- rejection list. Safe: the app's own student write paths (updateOwnProfile,
-- completeProfile) only write full_name/phone/birthday/goals, so nothing in the
-- app breaks. Admins + the service role still pass through untouched.
-- Idempotent: just replaces the function body (trigger already exists).

create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer as $$
begin
  -- Allow admins (or service role bypassing RLS) to update everything.
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  -- For everyone else: any change to admin/coach-only columns is rejected.
  if (new.is_admin is distinct from old.is_admin)
     or (new.is_blocked is distinct from old.is_blocked)
     or (new.notes is distinct from old.notes)
     or (new.approved is distinct from old.approved)
     or (new.has_monthly_fee is distinct from old.has_monthly_fee)
     or (new.monthly_fee_cents is distinct from old.monthly_fee_cents)
     or (new.service_type is distinct from old.service_type) then
    raise exception 'Sem permissão para alterar campos admin do perfil.';
  end if;

  return new;
end;
$$;
