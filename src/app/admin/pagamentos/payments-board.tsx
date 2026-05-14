"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEuro, formatMonthYear } from "@/lib/money";
import { bulkSetPaymentStatus, type PaymentStatus } from "./actions";
import { PaymentDrawer, type DrawerStudent } from "./payment-drawer";
import { StatusPill } from "./status-pill";

export type BoardRow = DrawerStudent & {
  effectiveStatus: PaymentStatus;
};

type BulkAction = { status: PaymentStatus; ids: string[] } | null;

export function PaymentsBoard({
  rows,
  month,
}: {
  rows: BoardRow[];
  month: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerStudent, setDrawerStudent] = useState<DrawerStudent | null>(null);
  const [pending, startTransition] = useTransition();
  const [bulkConfirm, setBulkConfirm] = useState<BulkAction>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.full_name?.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q)
      );
    });
  }, [query, rows]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    const allFilteredSelected = filtered.every((r) => selectedIds.has(r.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        // Toggle off everything currently visible
        for (const r of filtered) next.delete(r.id);
      } else {
        for (const r of filtered) next.add(r.id);
      }
      return next;
    });
  }

  function openBulk(status: PaymentStatus) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkConfirm({ status, ids });
  }

  function runBulk() {
    if (!bulkConfirm) return;
    const { status, ids } = bulkConfirm;
    startTransition(async () => {
      try {
        const result = await bulkSetPaymentStatus({
          user_ids: ids,
          month,
          status,
        });
        toast.success(
          status === "paid"
            ? `${result.updated} alunos marcados como pagos.`
            : status === "paused"
              ? `${result.updated} alunos em pausa.`
              : `${result.updated} alunos marcados por pagar.`,
        );
        setSelectedIds(new Set());
        setBulkConfirm(null);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível atualizar.",
        );
      }
    });
  }

  const selectedCount = selectedIds.size;
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  const bulkLabel = bulkConfirm
    ? bulkConfirm.status === "paid"
      ? "Marcar como pagos"
      : bulkConfirm.status === "paused"
        ? "Marcar em pausa"
        : "Marcar por pagar"
    : "";

  return (
    <>
      {/* Search */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Procurar aluno…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-10 pr-10 text-base"
            aria-label="Procurar alunos"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar pesquisa"
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {filtered.length}{" "}
          {filtered.length === 1 ? "aluno" : "alunos"}
        </p>
      </div>

      {/* Select-all / clear-selection toolbar */}
      <div className="mt-4 flex items-center justify-between border-b border-border/40 pb-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={selectAllFiltered}
            className="size-4"
          />
          Selecionar todos
        </label>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
          >
            Limpar ({selectedCount})
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Sem alunos a corresponder.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border/40 pb-32">
          {filtered.map((r) => {
            const selected = selectedIds.has(r.id);
            const tint =
              r.effectiveStatus === "paid"
                ? "bg-emerald-500/5"
                : r.effectiveStatus === "paused"
                  ? "bg-amber-500/5"
                  : "";
            const amount = r.record?.amount_cents ?? r.resolvedFee;
            return (
              <li key={r.id} className={tint}>
                <div className="flex items-center gap-3 py-3">
                  <label
                    className="flex shrink-0 cursor-pointer items-center pl-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleOne(r.id)}
                      className="size-5"
                      aria-label={`Selecionar ${r.full_name ?? r.email}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setDrawerStudent(r)}
                    className="flex flex-1 items-center gap-3 text-left active:opacity-70"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.full_name?.trim() || r.email}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusPill status={r.effectiveStatus} />
                        {r.record?.notes && (
                          <span className="truncate text-xs text-muted-foreground">
                            · {r.record.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {formatEuro(amount)}
                      </p>
                      {r.effectiveStatus === "paid" && r.record && (
                        <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          ✓ Pago
                        </p>
                      )}
                    </div>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Sticky bulk action bar */}
      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">
              {selectedCount} {selectedCount === 1 ? "selecionado" : "selecionados"}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => openBulk("paused")}
                variant="outline"
                className="h-11 flex-1 text-sm sm:flex-none"
              >
                Em pausa
              </Button>
              <Button
                onClick={() => openBulk("unpaid")}
                variant="outline"
                className="h-11 flex-1 text-sm sm:flex-none"
              >
                Por pagar
              </Button>
              <Button
                onClick={() => openBulk("paid")}
                className="h-11 flex-1 text-sm sm:flex-none"
              >
                Marcar pagos
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      <PaymentDrawer
        student={drawerStudent}
        month={month}
        onClose={() => setDrawerStudent(null)}
      />

      {/* Bulk confirmation dialog */}
      <Dialog
        open={!!bulkConfirm}
        onOpenChange={(v) => !v && !pending && setBulkConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{bulkLabel}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {bulkConfirm && (
                <>
                  Vais aplicar <strong>{bulkLabel.toLowerCase()}</strong> a{" "}
                  <strong>{bulkConfirm.ids.length}</strong>{" "}
                  {bulkConfirm.ids.length === 1 ? "aluno" : "alunos"} para{" "}
                  <strong>{formatMonthYear(month)}</strong>. Valores e notas
                  existentes são preservados.
                </>
              )}
            </p>
          </DialogHeader>
          <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setBulkConfirm(null)}
              disabled={pending}
              className="h-11 text-base sm:h-9 sm:text-sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={runBulk}
              disabled={pending}
              className="h-11 text-base sm:h-9 sm:text-sm"
            >
              {pending ? "A aplicar…" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
