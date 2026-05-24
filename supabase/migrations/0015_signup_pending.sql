-- 0015_signup_pending.sql
-- Guarantee every NEW signup lands pending (approved = false), so the coach
-- must approve before they can book.
--
-- 0009 flipped the column DEFAULT to false, but handle_new_user (0001) inserts
-- only (id, email) and so leans entirely on that default. If the default flip
-- didn't take on a given database, new accounts come out approved = true and
-- the gate silently does nothing. Make the trigger set approved explicitly so
-- it never depends on the column default again.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, approved)
  values (new.id, new.email, false);
  return new;
end;
$$;

-- Belt-and-suspenders: make the column default match the trigger.
alter table public.profiles alter column approved set default false;
