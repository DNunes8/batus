-- 0010_booking_write_lockdown.sql
-- Class capacity is enforced by the bookClass server action (it counts
-- booked seats with the service-role client before writing). A non-admin
-- could previously sidestep that check by writing the bookings table
-- directly via the REST API — inserting a booking into a full class, or
-- flipping their own row from 'waitlisted' to 'booked'.
--
-- Lock both paths down. All booking creation/promotion now goes through the
-- action (which uses the service-role client and bypasses RLS); non-admins
-- may only CANCEL their own bookings directly.

-- ----------------------------------------------------------------------------
-- INSERT: admin only. bookClass inserts via the service-role client, which
-- bypasses RLS, so legitimate booking is unaffected. Direct non-admin inserts
-- are now rejected.
-- ----------------------------------------------------------------------------
drop policy if exists "bookings_insert_own" on public.bookings;

create policy "bookings_insert_admin" on public.bookings
  for insert with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- UPDATE: a non-admin may only move a booking to 'cancelled'. Re-activating a
-- cancelled row, jumping the waitlist, or moving template/date is rejected —
-- those go through bookClass (service-role) or an admin.
-- ----------------------------------------------------------------------------
create or replace function public.protect_booking_changes()
returns trigger language plpgsql security definer as $$
begin
  -- Admins and the service-role client (no JWT → auth.uid() is null) bypass.
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if new.status is distinct from 'cancelled' then
    raise exception 'Só podes cancelar a tua marcação.';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_protect_changes on public.bookings;
create trigger bookings_protect_changes
  before update on public.bookings
  for each row execute procedure public.protect_booking_changes();
