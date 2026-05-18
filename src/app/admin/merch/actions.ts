"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth-guard";
import { parseEuroToCents } from "@/lib/money";

export async function createMerchItem(formData: FormData) {
  await assertAdmin();
  const supabase = await createClient();

  const name = ((formData.get("name") as string | null) ?? "").trim();
  const description =
    ((formData.get("description") as string | null) ?? "").trim() || null;
  const price_cents = parseEuroToCents(
    (formData.get("price") as string | null) ?? "0",
  );
  const stock = Number(formData.get("stock") ?? 0);
  const image_url =
    ((formData.get("image_url") as string | null) ?? "").trim() || null;

  if (!name) throw new Error("Nome obrigatório.");

  const { error } = await supabase.from("merch_items").insert({
    name,
    description,
    price_cents,
    stock,
    image_url,
    is_active: true,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/merch");
  revalidatePath("/loja");
  redirect("/admin/merch");
}

export async function toggleMerchActive(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  const next = formData.get("next") === "true";
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("merch_items")
    .update({ is_active: next })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/merch");
  revalidatePath("/loja");
}

export async function deleteMerchItem(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("ID em falta.");

  const supabase = await createClient();
  const { error } = await supabase.from("merch_items").delete().eq("id", id);

  if (error) {
    // Likely a RESTRICT FK violation because claims reference this item.
    throw new Error(
      "Não é possível apagar — existem pedidos para este item. Desativa em vez disso.",
    );
  }

  revalidatePath("/admin/merch");
  revalidatePath("/loja");
}
