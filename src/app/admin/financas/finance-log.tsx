"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatEuro } from "@/lib/money";
import { addFinanceEntry, removeFinanceEntry } from "./actions";
import type { FinanceEntry } from "@/lib/finances";

const INPUT =
  "h-10 w-full rounded-md border border-border/60 bg-transparent px-3 text-sm focus-visible:border-foreground focus-visible:outline-none";

const PT_MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${PT_MONTHS_SHORT[m - 1]}`;
}

// One money log — "Despesas" or "Outras receitas". Same shape, different kind.
// Add opens an inline form; each row has a × to remove it in one tap.
export function FinanceLog({
  title,
  kind,
  total,
  entries,
  defaultDate,
  minDate,
  maxDate,
  addLabel,
}: {
  title: string;
  kind: "income" | "expense";
  total: number;
  entries: FinanceEntry[];
  defaultDate: string;
  minDate: string;
  maxDate: string;
  addLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");

  function add() {
    if (pending) return;
    startTransition(async () => {
      try {
        const result = await addFinanceEntry({
          kind,
          category,
          amount,
          entry_date: date,
          note,
        });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Guardado.");
        setCategory("");
        setAmount("");
        setNote("");
        setDate(defaultDate);
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Não foi possível guardar. Tenta de novo.");
      }
    });
  }

  function remove(id: string) {
    if (pending) return;
    setRemovingId(id);
    startTransition(async () => {
      try {
        const result = await removeFinanceEntry({ id });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        router.refresh();
      } catch {
        toast.error("Não foi possível remover.");
      } finally {
        setRemovingId(null);
      }
    });
  }

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </h2>
        <span className="text-sm font-semibold tabular-nums">
          {formatEuro(total)}
        </span>
      </div>

      {entries.length > 0 && (
        <ul className="mt-3 divide-y divide-border/60 rounded-md border border-border/60">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.category}</p>
                <p className="text-xs text-muted-foreground">
                  {shortDate(e.entry_date)}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm tabular-nums">
                {formatEuro(e.amount_cents)}
              </span>
              <button
                type="button"
                onClick={() => remove(e.id)}
                disabled={pending && removingId === e.id}
                aria-label={`Remover ${e.category}`}
                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 text-base text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-40"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="mt-3 space-y-2 rounded-md border border-border/60 p-3">
          <input
            className={INPUT}
            placeholder={
              kind === "expense" ? "Categoria (ex: Renda)" : "O quê? (ex: Pack 10 aulas)"
            }
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className={INPUT}
              inputMode="decimal"
              placeholder="Valor €"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              className={INPUT}
              type="date"
              min={minDate}
              max={maxDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <input
            className={INPUT}
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 flex-1 rounded-md border border-border/60 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={add}
              disabled={pending}
              className="h-10 flex-1 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-50"
            >
              {pending ? "A guardar…" : "Adicionar"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex h-10 w-full items-center justify-center rounded-md border border-dashed border-border/60 text-sm font-medium transition-colors hover:border-foreground"
        >
          {addLabel}
        </button>
      )}
    </section>
  );
}
