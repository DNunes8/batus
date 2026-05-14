"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEuro, formatMonthYear } from "@/lib/money";
import {
  setPaymentStatus,
  setStudentHasMonthlyFee,
  setStudentServiceType,
  type PaymentStatus,
} from "./actions";
import { HistoryStrip, type HistoryCell } from "./history-strip";

export type ServiceType = "group" | "solo";

export type DrawerStudent = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  goals: string | null;
  notes: string | null;
  joined_at: string;
  service_type: ServiceType;
  has_monthly_fee: boolean;
  record: {
    status: PaymentStatus;
    amount_cents: number;
    notes: string | null;
  } | null;
  resolvedFee: number;
  history: HistoryCell[];
  solo_activity?: {
    sessions_this_month: number;
    revenue_this_month: number;
    last_session_date: string | null;
  };
};

type Props = {
  student: DrawerStudent | null;
  month: string; // YYYY-MM-01
  onClose: () => void;
};

function eurosFromCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatJoined(joined: string): string {
  return new Date(joined).toLocaleDateString("pt-PT", {
    year: "numeric",
    month: "short",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
  });
}

// Three big status buttons in a row, like a segmented control.
// One tap selects; Guardar in the footer commits.
function StatusButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border/60 text-foreground hover:bg-muted/40"
      }`}
    >
      {children}
    </button>
  );
}

export function PaymentDrawer({ student, month, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [moving, startMoving] = useTransition();

  const initialStatus: PaymentStatus = student?.record?.status ?? "unpaid";
  const initialAmount = student?.record
    ? eurosFromCents(student.record.amount_cents)
    : student
      ? eurosFromCents(student.resolvedFee)
      : "";
  const initialNotes = student?.record?.notes ?? "";

  const [status, setStatus] = useState<PaymentStatus>(initialStatus);
  const [amount, setAmount] = useState(initialAmount);
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (!student) return;
    setStatus(student.record?.status ?? "unpaid");
    setAmount(
      student.record
        ? eurosFromCents(student.record.amount_cents)
        : eurosFromCents(student.resolvedFee),
    );
    setNotes(student.record?.notes ?? "");
  }, [student]);

  if (!student) return null;

  const name = student.full_name?.trim() || student.email;
  const monthLabel = formatMonthYear(month);
  const isSolo = student.service_type === "solo";
  const showsPaymentForm = !isSolo || student.has_monthly_fee;

  function handleSave() {
    if (!student) return;
    const parsed = Math.max(
      0,
      Math.round(parseFloat(amount.replace(",", ".")) * 100),
    );
    if (isNaN(parsed)) {
      toast.error("Valor inválido.");
      return;
    }
    startTransition(async () => {
      try {
        await setPaymentStatus({
          user_id: student.id,
          month,
          status,
          amount_cents: parsed,
          notes,
        });
        toast.success(
          status === "paid"
            ? `${name} marcado como pago em ${monthLabel}.`
            : status === "paused"
              ? `${name} em pausa em ${monthLabel}.`
              : `${name} marcado por pagar em ${monthLabel}.`,
        );
        router.refresh();
        onClose();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível guardar.",
        );
      }
    });
  }

  function handleMove() {
    if (!student) return;
    const target: ServiceType = isSolo ? "group" : "solo";
    startMoving(async () => {
      try {
        await setStudentServiceType({
          user_id: student.id,
          service_type: target,
        });
        toast.success(
          target === "solo"
            ? `${name} movido para 1:1s.`
            : `${name} movido para Aulas de grupo.`,
        );
        router.refresh();
        onClose();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível mover.",
        );
      }
    });
  }

  function handleHasMonthlyFeeToggle(value: boolean) {
    if (!student) return;
    if (student.has_monthly_fee === value) return;
    startMoving(async () => {
      try {
        await setStudentHasMonthlyFee({
          user_id: student.id,
          has_monthly_fee: value,
        });
        toast.success(
          value
            ? `${name}: agora paga mensalmente.`
            : `${name}: paga à sessão.`,
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível guardar.",
        );
      }
    });
  }

  const hasChanges =
    status !== initialStatus ||
    amount !== initialAmount ||
    notes !== initialNotes;

  return (
    <Sheet
      open={!!student}
      onOpenChange={(v: boolean) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        {/* Header — pr-12 leaves room for Sheet's built-in close button (top-3 right-3) */}
        <div className="px-6 pr-12 pb-4 pt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {monthLabel} · {isSolo ? "1:1" : "Aulas de grupo"}
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-[0.04em]">
            {name}
          </h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {student.phone && (
              <>
                <a
                  href={`tel:${student.phone.replace(/\s/g, "")}`}
                  className="hover:text-foreground"
                >
                  {student.phone}
                </a>
                {" · "}
              </>
            )}
            desde {formatJoined(student.joined_at)}
          </p>
        </div>

        {/* Scrollable body — main action up top, context below */}
        <div className="flex-1 overflow-y-auto">
          {/* Primary action: status buttons (only when tracking monthly) */}
          {showsPaymentForm && (
            <section className="border-t border-border/60 px-6 py-5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Estado
              </Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <StatusButton
                  selected={status === "paid"}
                  onClick={() => setStatus("paid")}
                >
                  Pago
                </StatusButton>
                <StatusButton
                  selected={status === "unpaid"}
                  onClick={() => setStatus("unpaid")}
                >
                  Por pagar
                </StatusButton>
                <StatusButton
                  selected={status === "paused"}
                  onClick={() => setStatus("paused")}
                >
                  Pausa
                </StatusButton>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="amount" className="text-xs">
                    Valor (€)
                  </Label>
                  <Input
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    disabled={status === "paused"}
                    className="h-11 text-base sm:h-10 sm:text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Padrão</Label>
                  <p className="flex h-11 items-center text-sm text-muted-foreground sm:h-10">
                    {formatEuro(student.resolvedFee)}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <Label htmlFor="payment-notes" className="text-xs">
                  Notas (opcional)
                </Label>
                <Textarea
                  id="payment-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ex: cash, 4 sessões…"
                />
              </div>
            </section>
          )}

          {/* For solo per-session payers: there's no payment form. Show why. */}
          {!showsPaymentForm && (
            <section className="border-t border-border/60 bg-muted/30 px-6 py-5 text-sm">
              <p className="font-medium">Paga à sessão</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sem mensalidade fixa. O coach recebe na sessão, sem registo
                mensal para preencher.
              </p>
            </section>
          )}

          {/* Solo activity rollup — compact, one line */}
          {isSolo && student.solo_activity && (
            <section className="border-t border-border/60 px-6 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Em {monthLabel}
              </p>
              <p className="mt-1 text-sm">
                <strong className="tabular-nums">
                  {student.solo_activity.sessions_this_month}
                </strong>{" "}
                {student.solo_activity.sessions_this_month === 1
                  ? "sessão"
                  : "sessões"}{" "}
                ·{" "}
                <strong className="tabular-nums">
                  {formatEuro(student.solo_activity.revenue_this_month)}
                </strong>
                {student.solo_activity.last_session_date && (
                  <>
                    {" "}
                    · última{" "}
                    <span className="tabular-nums">
                      {formatShortDate(
                        student.solo_activity.last_session_date,
                      )}
                    </span>
                  </>
                )}
              </p>
            </section>
          )}

          {/* Solo: monthly-fee toggle, two compact buttons */}
          {isSolo && (
            <section className="border-t border-border/60 px-6 py-4">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Pagamento mensal fixo?
              </Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleHasMonthlyFeeToggle(true)}
                  disabled={moving}
                  className={`rounded-md border p-2 text-sm transition-colors ${
                    student.has_monthly_fee
                      ? "border-foreground bg-foreground/5 font-medium"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  Sim, mensal
                </button>
                <button
                  type="button"
                  onClick={() => handleHasMonthlyFeeToggle(false)}
                  disabled={moving}
                  className={`rounded-md border p-2 text-sm transition-colors ${
                    !student.has_monthly_fee
                      ? "border-foreground bg-foreground/5 font-medium"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  Não, à sessão
                </button>
              </div>
            </section>
          )}

          {/* History strip — only when we track monthly */}
          {showsPaymentForm && (
            <section className="border-t border-border/60 px-6 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Últimos 6 meses
              </p>
              <div className="mt-2">
                <HistoryStrip cells={student.history} />
              </div>
            </section>
          )}

          {/* Footer links: profile + move-between-tabs */}
          <section className="border-t border-border/60 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <Link
                href={`/admin/students/${student.id}`}
                className="uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
              >
                Ver perfil →
              </Link>
              <button
                type="button"
                onClick={handleMove}
                disabled={moving}
                className="uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {moving
                  ? "A mover…"
                  : isSolo
                    ? "← Mover para Aulas de grupo"
                    : "Mover para 1:1s →"}
              </button>
            </div>
          </section>
        </div>

        {/* Sticky save bar (only when there's something to save) */}
        {showsPaymentForm && (
          <footer className="sticky bottom-0 border-t border-border/60 bg-popover px-6 py-4">
            <Button
              onClick={handleSave}
              disabled={pending || !hasChanges}
              className="h-12 w-full text-base"
            >
              {pending
                ? "A guardar…"
                : hasChanges
                  ? "Guardar"
                  : "Sem alterações"}
            </Button>
          </footer>
        )}
      </SheetContent>
    </Sheet>
  );
}
