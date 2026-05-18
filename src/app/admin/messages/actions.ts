"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth-guard";

export async function markMessageRead(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/messages");
}

export async function markMessageUnread(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ read_at: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/messages");
}

export async function deleteMessage(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/messages");
}
