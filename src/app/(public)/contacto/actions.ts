"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function submitContactMessage(formData: FormData) {
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  const phone = ((formData.get("phone") as string | null) ?? "").trim() || null;
  const message = ((formData.get("message") as string | null) ?? "").trim();

  if (!name || !email || !message) {
    redirect("/contacto?error=missing");
  }

  // Use admin client because the form is public (no auth required) and the
  // table's INSERT policy is open, but we still want server-side
  // identity for any future moderation logic.
  const admin = createAdminClient();
  const { error } = await admin.from("contact_messages").insert({
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
