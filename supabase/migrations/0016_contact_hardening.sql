-- 0016_contact_hardening.sql
-- Locks down the public contact form so bots can't bypass the server-action
-- spam guards (honeypot + timing) by POSTing straight to PostgREST with the
-- public anon key.
--
-- Before: contact_messages had `for insert with check (true)`, so anyone with
-- the (public, NEXT_PUBLIC) anon key could insert unlimited rows directly,
-- ignoring every guard, which lives only in the server action.
--
-- After: the open public INSERT policy is removed, so the anon role can no
-- longer insert at all. The /contacto server action now writes via the
-- service-role client (createAdminClient), which bypasses RLS — so legitimate,
-- guarded submissions still work, but a direct anon POST is rejected. The
-- char_length CHECKs bound row size as defense-in-depth (and apply to the
-- service-role path too).
--
-- ORDER OF OPERATIONS: deploy the app code that uses the service-role client
-- for this insert BEFORE running this migration, or run it while the site is
-- down. (If the old anon-client code were live when this runs, the form would
-- start failing.) Safe to run once the new build is serving.

-- 1) Remove the open public insert.
drop policy if exists "contact_messages_public_insert" on public.contact_messages;

-- 2) Bound field lengths (cheap guard against bloat / abuse). If this fails,
--    an existing row is longer than a limit — tell me and we'll widen/clean it.
alter table public.contact_messages
  add constraint contact_messages_name_len    check (char_length(name)    <= 120),
  add constraint contact_messages_email_len   check (char_length(email)   <= 200),
  add constraint contact_messages_phone_len   check (phone is null or char_length(phone) <= 40),
  add constraint contact_messages_message_len check (char_length(message) <= 2000);
