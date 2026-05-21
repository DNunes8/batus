// Birthday-as-three-dropdowns helpers. We capture date of birth via three
// native <select>s (Dia / Mês / Ano) — the cleanest mobile UX. The DB column
// stores a Postgres `date` (YYYY-MM-DD); these helpers convert between the
// form fields and that ISO string, and supply the option lists.

export const MONTHS_PT = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
] as const;

export const BIRTHDAY_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Year list: most recent at top so adult users find their year quickly.
// 100 years back covers everyone realistically; older students get fixed
// from the admin page.
export function birthYearOptions(now = new Date()): number[] {
  const max = now.getFullYear();
  const min = max - 100;
  const years: number[] = [];
  for (let y = max; y >= min; y--) years.push(y);
  return years;
}

// Split a stored ISO date (YYYY-MM-DD) into the three form-field strings.
// Returns empty strings when the input is null/invalid so the placeholders
// stay selected on render.
export function splitBirthday(iso: string | null | undefined): {
  day: string;
  month: string;
  year: string;
} {
  if (!iso) return { day: "", month: "", year: "" };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return { day: "", month: "", year: "" };
  return {
    year: m[1],
    month: String(Number(m[2])),
    day: String(Number(m[3])),
  };
}

// Combine three form-field strings into a stored ISO date, or null if any
// piece is missing OR the combination isn't a real calendar date (Feb 30
// etc. — caught by round-tripping through Date).
export function parseBirthday(
  day: string | null,
  month: string | null,
  year: string | null,
): string | null {
  if (!day || !month || !year) return null;
  const d = Number(day);
  const mo = Number(month);
  const y = Number(year);
  if (!Number.isFinite(d) || !Number.isFinite(mo) || !Number.isFinite(y)) {
    return null;
  }
  const iso = `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() + 1 !== mo ||
    parsed.getUTCDate() !== d
  ) {
    return null;
  }
  return iso;
}

// Convenience: pull the three fields straight out of a FormData.
export function parseBirthdayFromForm(formData: FormData): string | null {
  return parseBirthday(
    formData.get("birthday_day") as string | null,
    formData.get("birthday_month") as string | null,
    formData.get("birthday_year") as string | null,
  );
}
