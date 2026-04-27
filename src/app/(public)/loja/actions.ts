"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function claimItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/loja");
  }

  const item_id = formData.get("item_id") as string | null;
  if (!item_id) throw new Error("Item inválido.");

  const { error } = await supabase.rpc("claim_merch", {
    p_item_id: item_id,
    p_quantity: 1,
  });

  if (error) {
    // Stock failures and other RPC raises bubble up here.
    throw new Error(error.message);
  }

  revalidatePath("/loja");
  revalidatePath("/perfil");
}
