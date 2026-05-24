// Six-month payment history — "action-first". Visual weight tracks how much
// attention a month needs, so the coach's eye lands on what matters:
//   • por pagar → LOUD: solid fill, "Falta". These need chasing.
//   • paid      → quiet: faint check. Done, ignore.
//   • em pausa  → muted dashed, "Pausa".
//   • sem registo → faintest dot.
// The current month is tagged "este mês" so "this vs last month" is obvious.

import { formatMonthYear } from "@/lib/money";
import type { PaymentStatus } from "./actions";

export type HistoryCell = {
  month: string; // YYYY-MM-01
  status: PaymentStatus | null; // null = no record at all
  isCurrent?: boolean;
};

const SHORT_PT_MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function shortMonth(month: string): string {
  const [, m] = month.split("-").map(Number);
  return SHORT_PT_MONTHS[m - 1];
}

function cellClasses(status: PaymentStatus | null): string {
  switch (status) {
    case "unpaid":
      // Loudest — it's the action item.
      return "border-foreground bg-foreground text-background";
    case "paused":
      return "border-dashed border-muted-foreground/40 text-muted-foreground";
    case "paid":
      // Receded — done, no attention needed.
      return "border-border/50 text-muted-foreground/60";
    default:
      return "border-transparent text-muted-foreground/25";
  }
}

function cellText(status: PaymentStatus | null): string {
  switch (status) {
    case "unpaid":
      return "Falta";
    case "paused":
      return "Pausa";
    case "paid":
      return "✓";
    default:
      return "·";
  }
}

function labelFor(status: PaymentStatus | null): string {
  switch (status) {
    case "paid":
      return "Pago";
    case "paused":
      return "Em pausa";
    case "unpaid":
      return "Por pagar";
    default:
      return "Sem registo";
  }
}

export function HistoryStrip({ cells }: { cells: HistoryCell[] }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {cells.map((c) => (
        <div
          key={c.month}
          title={`${formatMonthYear(c.month)} — ${labelFor(c.status)}`}
          className="flex flex-col items-center gap-1"
        >
          <div
            className={`flex h-10 w-full items-center justify-center rounded-sm border text-[10px] font-semibold ${cellClasses(
              c.status,
            )}`}
          >
            {cellText(c.status)}
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider ${
              c.isCurrent
                ? "font-bold text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {shortMonth(c.month)}
          </span>
          {/* Reserve the line on every column so the row stays aligned;
              only the current month fills it. */}
          <span className="h-3 text-[9px] uppercase tracking-wide text-muted-foreground">
            {c.isCurrent ? "este mês" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
