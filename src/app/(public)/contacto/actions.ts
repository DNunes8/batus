"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// A human plausibly takes at least this long to fill name + email + message.
// Anything faster is almost certainly a bot.
const MIN_FILL_SECONDS = 3;

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

  const name = ((formData.get("name") as string | null) ?? "").trim();
  const email = ((formData.get("email") as string | null) ?? "")
    .trim()
    .toLowerCase();
  const phone = ((formData.get("phone") as string | null) ?? "").trim() || null;
  const message = ((formData.get("message") as string | null) ?? "").trim();

  if (!name || !email || !message) {
    redirect("/contacto?error=missing");
  }

  // Public, unauthenticated form — the regular client + the open INSERT
  // policy on contact_messages is enough. No need for the service-role
  // client here (it shouldn't touch an unauthenticated endpoint).
  const supabase = await createClient();
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
