"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth-guard";
import { parseEuroToCents } from "@/lib/money";

// Add a manual money line — an expense or "outra receita" (pack sale, one-off).
// Returns { error } for expected failures (Next masks thrown Server Action
// messages in production).
export async function addFinanceEntry(input: {
  kind: "income" | "expense";
  category: string;
  amount: string;
  entry_date: string;
  note?: string | null;
}): Promise<{ error?: string }> {
  await assertAdmin();

  const kind = input.kind === "income" ? "income" : "expense";
  const category = (input.category ?? "").trim().slice(0, 60);
  if (!category) return { error: "Escreve uma categoria." };

  const amount_cents = parseEuroToCents(input.amount ?? "");
  if (!Number.isFinite(amount_cents) || amount_cents <= 0) {
    return { error: "Escreve um valor." };
  }

  const entry_date = (input.entry_date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
    return { error: "Data inválida." };
  }

  const note = ((input.note ?? "").trim() || null)?.slice(0, 200) ?? null;

  const supabase = await createClient();
  const { error } = await supabase.from("finance_entries").insert({
    kind,
    category,
    amount_cents,
    entry_date,
    note,
  });
  if (error) return { error: "Não foi possível guardar. Tenta de novo." };

  revalidatePath("/admin/financas");
  return {};
}

export async function removeFinanceEntry(input: {
  id: string;
}): Promise<{ error?: string }> {
  await assertAdmin();
  if (!input.id) return { error: "ID em falta." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_entries")
    .delete()
    .eq("id", input.id);
  if (error) return { error: "Não foi possível remover." };

  revalidatePath("/admin/financas");
  return {};
}
