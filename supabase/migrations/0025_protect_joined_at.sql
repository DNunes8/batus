-- Stop a student rewriting their own joined_at or email.
--
-- protect_profile_columns() is an allow-list-by-omission: it names the columns
-- a student may NOT change, and anything not named is fair game. joined_at was
-- never named, while RLS (profiles_update_own_or_admin, 0001) lets any signed-in
-- user UPDATE their own profiles row, and the anon key is compiled into the
-- browser bundle by design.
--
-- joined_at is not decorative. isUnpaidAndBlocked() (src/lib/payment.ts) exempts
-- anyone whose joined_at month is the current month — the first-month grace — and
-- the payment-reminder cron uses the same test to decide who to chase. So one
-- PATCH from the browser console, setting joined_at to today, switches off the
-- unpaid-booking gate for that student and removes them from the reminder list,
-- every month, for as long as they keep moving it forward.
--
-- email has the same shape and a different consequence: it is what the studio
-- writes to. profiles.email is set once by handle_new_user() from the auth
-- record (0001) and the app never writes it again, so a student could point
-- every cancellation, reschedule and payment reminder at another address —
-- including someone else's — while their login stayed unchanged.
--
-- This is the same hole 0017 closed for has_monthly_fee, with two columns missed.
-- Nothing in the app writes either column after signup, so pinning them costs
-- nothing:
-- an admin can still change it (the is_admin() short-circuit above), and the
-- service-role client used by the server actions bypasses the trigger's
-- auth.uid() check entirely.

create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if (new.is_admin is distinct from old.is_admin)
     or (new.is_blocked is distinct from old.is_blocked)
     or (new.notes is distinct from old.notes)
     or (new.approved is distinct from old.approved)
     or (new.has_monthly_fee is distinct from old.has_monthly_fee)
     or (new.monthly_fee_cents is distinct from old.monthly_fee_cents)
     or (new.service_type is distinct from old.service_type)
     or (new.weekly_class_limit is distinct from old.weekly_class_limit)
     or (new.class_credits is distinct from old.class_credits)
     or (new.joined_at is distinct from old.joined_at)
     or (new.email is distinct from old.email) then
    raise exception 'Sem permissão para alterar campos admin do perfil.';
  end if;
  return new;
end;
$$;

-- Confirmation. Expect both true.
select position('joined_at' in prosrc) > 0 as joined_at_protected,
       position('new.email' in prosrc) > 0 as email_protected
from pg_proc
where proname = 'protect_profile_columns';
