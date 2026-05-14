// Small reusable status pill used by the list rows + the drawer header.

import type { PaymentStatus } from "./actions";

const STYLES: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: {
    label: "Pago",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  unpaid: {
    label: "Por pagar",
    cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
  paused: {
    label: "Em pausa",
    cls: "bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30",
  },
};

export function StatusPill({
  status,
  size = "sm",
}: {
  status: PaymentStatus;
  size?: "sm" | "md";
}) {
  const s = STYLES[status];
  const sizeCls =
    size === "md"
      ? "px-3 py-1 text-xs"
      : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium uppercase tracking-wider ${sizeCls} ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
