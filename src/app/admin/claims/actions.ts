"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function fulfillClaim(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("fulfill_merch_claim", {
    p_claim_id: id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/claims");
  revalidatePath("/admin/merch");
  revalidatePath("/loja");
}

export async function cancelClaim(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_merch_claim", {
    p_claim_id: id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/claims");
  revalidatePath("/admin/merch");
  revalidatePath("/loja");
}
