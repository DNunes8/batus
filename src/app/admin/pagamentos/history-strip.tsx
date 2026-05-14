// Six-month strip used in the drawer + the student detail page.
// Monochrome by design: shape encodes state, not colour.
//   ▣ filled  = pago
//   ▢ outline = por pagar (had a row, but didn't pay)
//   ◌ dashed  = em pausa
//   · light   = sem registo (no row at all that month)

import { formatMonthYear } from "@/lib/money";
import type { PaymentStatus } from "./actions";

export type HistoryCell = {
  month: string; // YYYY-MM-01
  status: PaymentStatus | null; // null = no record at all
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
    case "paid":
      return "bg-foreground border-foreground";
    case "unpaid":
      return "border-foreground/60";
    case "paused":
      return "border-muted-foreground/40 border-dashed";
    default:
      return "border-muted-foreground/15";
  }
}

function glyph(status: PaymentStatus | null): string {
  switch (status) {
    case "paid":
      return "✓";
    case "unpaid":
      return "!";
    case "paused":
      return "II";
    default:
      return "·";
  }
}

function glyphColor(status: PaymentStatus | null): string {
  switch (status) {
    case "paid":
      return "text-background";
    case "unpaid":
      return "text-foreground";
    case "paused":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground/40";
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
            className={`flex h-10 w-full items-center justify-center rounded-sm border text-[10px] font-medium ${cellClasses(
              c.status,
            )} ${glyphColor(c.status)}`}
          >
            {glyph(c.status)}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {shortMonth(c.month)}
          </span>
        </div>
      ))}
    </div>
  );
}
