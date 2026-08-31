// Always store money as integer cents in the DB. Format/parse at the edges.

export function formatEuro(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

// Money typed by a human: "50", "50,00", "50.00", "30€", "12,50 €", and with a
// Portuguese thousands separator, "1.234,56". Returns integer cents, or null
// when the input is not an amount at all.
//
// Null rather than 0 is the whole point. The old parser answered 0 for anything
// it could not read, so a coach typing "cinquenta" recorded that a student pays
// nothing — invisible on screen and missing from Finanças. Callers decide what
// to do with null; the ones that write money refuse and say so.
export function parseEuroOrNull(
  input: string | null | undefined,
): number | null {
  if (input == null) return null;

  // Drop the currency symbol and any spaces around it — people type "30€".
  let text = input.trim().replace(/€/g, "").replace(/\s/g, "");
  if (text === "") return null;

  // Separators: pt-PT writes 1.234,56, en writes 1,234.56, and plenty of people
  // write plain 1234.56 or 1234,56. Whichever mark comes LAST is the decimal
  // point; anything of the same kind before it is a thousands separator.
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    text = text.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma !== -1) {
    text = text.replace(",", ".");
  }

  // Now it must be a plain number and nothing else — parseFloat("50abc") is 50.
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const num = Number(text);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

// Convenience wrapper for the places where 0 is a sensible reading of "nothing
// entered". Prefer parseEuroOrNull anywhere a wrong 0 would be stored as money.
export function parseEuroToCents(input: string | null | undefined): number {
  return parseEuroOrNull(input) ?? 0;
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
