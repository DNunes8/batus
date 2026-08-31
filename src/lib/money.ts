// Always store money as integer cents in the DB. Format/parse at the edges.

export function formatEuro(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

// Accepts "50", "50.00", or "50,00" — returns integer cents (0 on invalid).
//
// The 0-on-invalid behaviour is only safe where 0 is a sensible default. Where
// a wrong 0 would be recorded as money — a monthly fee, a payment row — use
// parseEuroOrNull and refuse instead: "€50" and "cinquenta" both parse to NaN
// here, and a coach's typo silently becoming "pays nothing" is the exact shape
// of bug that hides revenue.
export function parseEuroToCents(input: string | null | undefined): number {
  return parseEuroOrNull(input) ?? 0;
}

// Same parse, but null when the input is not a usable amount. An empty string
// is null too — "not filled in" is not "zero".
export function parseEuroOrNull(
  input: string | null | undefined,
): number | null {
  if (input == null) return null;
  const normalized = input.trim().replace(",", ".");
  if (normalized === "") return null;
  const num = parseFloat(normalized);
  // parseFloat("50abc") is 50, so check the whole string is a number.
  if (!/^\d*\.?\d+$/.test(normalized)) return null;
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

const PT_MONTHS_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// "2026-04-01" -> "Abril 2026"
export function formatMonthYear(monthDate: string): string {
  const [y, m] = monthDate.split("-").map(Number);
  return `${PT_MONTHS_LONG[m - 1]} ${y}`;
}

// Returns YYYY-MM-01 string for the given Date.
export function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}
