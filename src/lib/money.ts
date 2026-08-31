// Always store money as integer cents in the DB. Format/parse at the edges.

export function formatEuro(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

// Accepts "50", "50.00", or "50,00" — returns integer cents (0 on invalid).
export function parseEuroToCents(input: string | null | undefined): number {
  if (!input) return 0;
  const normalized = input.trim().replace(",", ".");
  const num = parseFloat(normalized);
  if (isNaN(num) || num < 0) return 0;
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
