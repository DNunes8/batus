"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// A human plausibly takes at least this long to fill name + email + message.
// Anything faster is almost certainly a bot.
const MIN_FILL_SECONDS = 3;

// Field length caps — mirror the DB CHECK constraints in migration 0016 so
// over-long input is trimmed before insert (and the DB rejects anything that
// somehow bypasses this).
const MAX = { name: 120, email: 200, phone: 40, message: 2000 };

export async function submitContactMessage(formData: FormData) {
  // --- Spam guards (no captcha needed for a studio this size) ---
  // Honeypot: a field hidden from real users. If it's filled, it's a bot.
  const honeypot = ((formData.get("website") as string | null) ?? "").trim();
  // Timing: the form carries its render timestamp; an instant submit is a
  // bot. A crafted timestamp can fake this, so it's only a secondary signal.
  const loadedAt = Number(formData.get("form_loaded_at"));
  const tooFast =
    Number.isFinite(loadedAt) &&
    loadedAt > 0 &&
    Date.now() - loadedAt < MIN_FILL_SECONDS * 1000;

  if (honeypot || tooFast) {
    // Pretend it worked so the bot doesn't probe further. Nothing is saved.
    redirect("/contacto?sent=1");
  }

  const name = ((formData.get("name") as string | null) ?? "")
    .trim()
    .slice(0, MAX.name);
  const email = ((formData.get("email") as string | null) ?? "")
    .trim()
    .toLowerCase()
    .slice(0, MAX.email);
  const phone =
    ((formData.get("phone") as string | null) ?? "")
      .trim()
      .slice(0, MAX.phone) || null;
  const message = ((formData.get("message") as string | null) ?? "")
    .trim()
    .slice(0, MAX.message);

  if (!name || !email || !message) {
    redirect("/contacto?error=missing");
  }

  // Write with the SERVICE-ROLE client. Migration 0016 removed the open public
  // INSERT policy on contact_messages, so a bot can no longer POST straight to
  // PostgREST with the anon key and skip the guards above — only this guarded
  // server action (which bypasses RLS) can write.
  const supabase = createAdminClient();
  const { error } = await supabase.from("contact_messages").insert({
    name,
    email,
    phone,
    message,
  });

  if (error) {
    redirect("/contacto?error=server");
  }

  redirect("/contacto?sent=1");
}
