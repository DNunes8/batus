"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import {
  Sheet,
  SheetClose,
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
import { StatusPill } from "./status-pill";
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
  // Current month's record, if any.
  record: {
    status: PaymentStatus;
    amount_cents: number;
    notes: string | null;
  } | null;
  // Resolved amount when there's no record (default or per-student override).
  resolvedFee: number;
  // 6-cell history including the selected month.
  history: HistoryCell[];
  // Optional 1:1 activity context (only meaningful for solo students).
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

const STATUS_OPTIONS: { value: PaymentStatus; label: string; hint: string }[] = [
  { value: "paid", label: "Pago", hint: "Pagamento recebido" },
  { value: "unpaid", label: "Por pagar", hint: "Mensalidade em dívida" },
  { value: "paused", label: "Em pausa", hint: "Não paga este mês" },
];

function eurosFromCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatJoined(joined: string): string {
  return new Date(joined).toLocaleDateString("pt-PT", {
    year: "numeric",
    month: "long",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
  });
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

  // Reset internal state every time the drawer opens with a different student.
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
  // For solo students who pay per-session, the whole payment form is hidden —
  // there's nothing to track monthly.
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
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        {/* Header */}
        <header className="border-b border-border/60 px-6 pb-4 pt-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {monthLabel}
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {isSolo ? "1:1" : "Aulas de grupo"}
            </p>
          </div>
          <h2 className="mt-1 font-display text-2xl tracking-[0.04em]">
            {name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {showsPaymentForm ? (
              <StatusPill status={status} />
            ) : (
              <span className="inline-flex items-center rounded-full border border-muted-foreground/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Pago à sessão
              </span>
            )}
            {student.phone && (
              <a
                href={`tel:${student.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Phone className="size-3" />
                {student.phone}
              </a>
            )}
            <span>Aluno desde {formatJoined(student.joined_at)}</span>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 space-y-6 px-6 py-5">
          {/* Solo activity rollup */}
          {isSolo && student.solo_activity && (
            <section className="rounded-md border border-border/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Atividade em {monthLabel}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <div>
                  <p className="font-display text-xl tabular-nums">
                    {student.solo_activity.sessions_this_month}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    sessões
                  </p>
                </div>
                <div>
                  <p className="font-display text-xl tabular-nums">
                    {formatEuro(student.solo_activity.revenue_this_month)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    receita
                  </p>
                </div>
                <div>
                  <p className="font-display text-xl tabular-nums">
                    {student.solo_activity.last_session_date
                      ? formatShortDate(
                          student.solo_activity.last_session_date,
                        )
                      : "—"}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    última
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Recent payment history (only if monthly tracking is on) */}
          {showsPaymentForm && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Últimos 6 meses
              </p>
              <HistoryStrip cells={student.history} />
            </section>
          )}

          {/* Profile context */}
          {(student.goals || student.notes) && (
            <section className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Sobre o aluno
              </p>
              {student.goals && (
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Objetivos: </span>
                  {student.goals}
                </p>
              )}
              {student.notes && (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Notas: </span>
                  {student.notes}
                </p>
              )}
              <Link
                href={`/admin/students/${student.id}`}
                className="mt-3 inline-block text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
              >
                Editar perfil →
              </Link>
            </section>
          )}

          {/* Solo-only: monthly tracking toggle */}
          {isSolo && (
            <section className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Pagamento mensal fixo?
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    student.has_monthly_fee || handleHasMonthlyFeeToggle(true)
                  }
                  disabled={moving}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    student.has_monthly_fee
                      ? "border-foreground bg-foreground/5"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-medium">Sim</p>
                  <p className="text-xs text-muted-foreground">
                    Mensalidade ou bulk pré-pago
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    !student.has_monthly_fee ||
                    handleHasMonthlyFeeToggle(false)
                  }
                  disabled={moving}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    !student.has_monthly_fee
                      ? "border-foreground bg-foreground/5"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-medium">Não</p>
                  <p className="text-xs text-muted-foreground">
                    Paga à sessão (cash)
                  </p>
                </button>
              </div>
            </section>
          )}

          {/* This month form — only when we actually track monthly */}
          {showsPaymentForm && (
            <section className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Estado em {monthLabel}
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                        status === opt.value
                          ? "border-foreground bg-foreground/5"
                          : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={opt.value}
                        checked={status === opt.value}
                        onChange={() => setStatus(opt.value)}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {opt.hint}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-xs">
                    Valor (€)
                  </Label>
                  <Input
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                    disabled={status === "paused"}
                    className="h-11 text-base sm:h-9 sm:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Mensalidade base</Label>
                  <p className="flex h-11 items-center text-sm text-muted-foreground sm:h-9">
                    {formatEuro(student.resolvedFee)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-notes" className="text-xs">
                  Notas do pagamento
                </Label>
                <Textarea
                  id="payment-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ex: pago em dinheiro, 4 sessões em Maio…"
                />
              </div>
            </section>
          )}

          {/* Move to other tab */}
          <section className="border-t border-border/40 pt-4">
            <button
              type="button"
              onClick={handleMove}
              disabled={moving}
              className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {moving
                ? "A mover…"
                : isSolo
                  ? "← Mover para Aulas de grupo"
                  : "Mover para 1:1s →"}
            </button>
          </section>
        </div>

        {/* Footer */}
        <footer className="sticky bottom-0 flex gap-3 border-t border-border/60 bg-popover px-6 py-4">
          <SheetClose
            render={
              <Button variant="outline" className="h-12 flex-1 text-base">
                Fechar
              </Button>
            }
          />
          {showsPaymentForm && (
            <Button
              onClick={handleSave}
              disabled={pending || !hasChanges}
              className="h-12 flex-1 text-base"
            >
              {pending ? "A guardar…" : "Guardar"}
            </Button>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}
