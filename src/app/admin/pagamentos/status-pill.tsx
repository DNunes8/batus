// Small reusable status pill used by the list rows + the drawer header.
// Monochrome on purpose — visual weight scales with required-action:
//   • Por pagar (needs action)   → strong outline, full-contrast text
//   • Em pausa  (informational)  → muted, lower contrast
//   • Pago      (handled, quiet) → tiny check, muted text — fades back

import type { PaymentStatus } from "./actions";

const STYLES: Record<
  PaymentStatus,
  { label: string; cls: string; prefix?: string }
> = {
  paid: {
    label: "Pago",
    prefix: "✓",
    cls: "border-transparent text-muted-foreground",
  },
  unpaid: {
    label: "Por pagar",
    cls: "border-foreground/60 text-foreground",
  },
  paused: {
    label: "Em pausa",
    cls: "border-muted-foreground/30 text-muted-foreground",
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
    size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium uppercase tracking-wider ${sizeCls} ${s.cls}`}
    >
      {s.prefix && <span aria-hidden>{s.prefix}</span>}
      {s.label}
    </span>
  );
}
