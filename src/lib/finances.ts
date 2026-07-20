import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, dayOfWeek, todayLisbon } from "@/lib/schedule";

// The Finanças data layer. Revenue is SUMMED live from the tables that already
// own it — payment_records (mensalidades), solo_sessions + recurring templates
// (PTs), merch_claims (loja) — so nothing is duplicated. finance_entries only
// holds the manual half the coach types: expenses + "outras receitas" (packs,
// one-offs). Everything is aggregated over a rolling 6-month window so the page
// can show both the selected month and the trend from one fetch.

export type FinanceMonth = {
  month: string; // YYYY-MM-01
  mensalidades: number;
  pts: number;
  loja: number;
  outras: number; // manual income
  receitas: number; // mensalidades + pts + loja + outras
  despesas: number; // manual expenses
  resultado: number; // receitas - despesas
};

export type FinanceEntry = {
  id: string;
  kind: "income" | "expense";
  category: string;
  amount_cents: number;
  entry_date: string;
  note: string | null;
};

export type Finances = {
  months: FinanceMonth[]; // 6, oldest first
  current: FinanceMonth;
  incomeEntries: FinanceEntry[]; // selected month, newest first
  expenseEntries: FinanceEntry[]; // selected month, newest first
  alunos: { ativos: number; pausa: number; novos: number; total: number };
};

function shiftMonth(monthIso: string, delta: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function lastDayOfMonth(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

const monthOf = (dateIso: string) => `${dateIso.slice(0, 7)}-01`;

export async function getFinances(monthIso: string): Promise<Finances> {
  const admin = createAdminClient();
  const selected = monthIso; // YYYY-MM-01
  const oldest = shiftMonth(selected, -5);
  const today = todayLisbon();
  // Don't count PT sessions in the future: cap the walk at today or the end of
  // the selected month, whichever is earlier.
  const selMonthEnd = lastDayOfMonth(selected);
  const walkEnd = selMonthEnd < today ? selMonthEnd : today;

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(selected, -i));

  const [
    paymentsRes,
    oneOffSolosRes,
    soloTemplatesRes,
    soloOverridesRes,
    merchRes,
    entriesRes,
    profilesRes,
  ] = await Promise.all([
    admin
      .from("payment_records")
      .select("month, amount_cents, status")
      .gte("month", oldest)
      .lte("month", selected),
    admin
      .from("solo_sessions")
      .select("session_date, price_cents")
      .gte("session_date", `${oldest}T00:00:00`),
    admin
      .from("solo_session_templates")
      .select(
        "id, user_id, day_of_week, price_cents, active_from, active_until, is_preset",
      ),
    admin
      .from("solo_session_overrides")
      .select("template_id, instance_date, cancelled")
      .gte("instance_date", oldest),
    admin
      .from("merch_claims")
      .select("quantity, fulfilled_at, merch_items(price_cents)")
      .eq("status", "fulfilled")
      .not("fulfilled_at", "is", null)
      .gte("fulfilled_at", `${oldest}T00:00:00`),
    admin
      .from("finance_entries")
      .select("id, kind, category, amount_cents, entry_date, note")
      .gte("entry_date", oldest),
    admin.from("profiles").select("approved, is_blocked, is_admin, joined_at"),
  ]);

  const byMonth = new Map<string, FinanceMonth>();
  for (const m of months) {
    byMonth.set(m, {
      month: m,
      mensalidades: 0,
      pts: 0,
      loja: 0,
      outras: 0,
      receitas: 0,
      despesas: 0,
      resultado: 0,
    });
  }

  // Mensalidades — only paid records count as revenue.
  for (const r of paymentsRes.data ?? []) {
    if (r.status !== "paid") continue;
    const b = byMonth.get(r.month as string);
    if (b) b.mensalidades += (r.amount_cents as number) ?? 0;
  }

  // PTs — one-off sessions (skip any in the future, same as the recurring walk)...
  for (const s of oneOffSolosRes.data ?? []) {
    const date = (s.session_date as string).slice(0, 10);
    if (date > walkEnd) continue;
    const b = byMonth.get(monthOf(s.session_date as string));
    if (b) b.pts += (s.price_cents as number) ?? 0;
  }
  // ...plus recurring templates walked weekly, skipping cancelled overrides.
  // Only presets are skipped (not null-user templates) — a recurring PT for a
  // walk-in with no app account is real revenue, and the Pagamentos chart counts
  // it. Filtering on user_id here would undercount and disagree with that page.
  const overrides = soloOverridesRes.data ?? [];
  for (const tpl of soloTemplatesRes.data ?? []) {
    if (tpl.is_preset) continue;
    const start =
      (tpl.active_from as string) > oldest ? (tpl.active_from as string) : oldest;
    const end =
      tpl.active_until && (tpl.active_until as string) < walkEnd
        ? (tpl.active_until as string)
        : walkEnd;
    let cursor = start;
    while (cursor <= end && dayOfWeek(cursor) !== tpl.day_of_week) {
      cursor = addDays(cursor, 1);
    }
    while (cursor <= end) {
      const ov = overrides.find(
        (o) => o.template_id === tpl.id && o.instance_date === cursor,
      );
      if (!ov?.cancelled) {
        const b = byMonth.get(monthOf(cursor));
        if (b) b.pts += (tpl.price_cents as number) ?? 0;
      }
      cursor = addDays(cursor, 7);
    }
  }

  // Loja — fulfilled merch claims, by the date they were fulfilled (paid).
  for (const c of merchRes.data ?? []) {
    if (!c.fulfilled_at) continue;
    const b = byMonth.get(monthOf(c.fulfilled_at as string));
    if (!b) continue;
    // PostgREST embeds the related row as an array unless the FK is detected as
    // to-one — handle both shapes so loja revenue isn't silently dropped.
    const item = c.merch_items as
      | { price_cents: number }
      | { price_cents: number }[]
      | null;
    const price = Array.isArray(item)
      ? (item[0]?.price_cents ?? 0)
      : (item?.price_cents ?? 0);
    b.loja += price * ((c.quantity as number) ?? 1);
  }

  // Manual entries — expenses + outras receitas.
  const allEntries = (entriesRes.data ?? []) as FinanceEntry[];
  for (const e of allEntries) {
    const b = byMonth.get(monthOf(e.entry_date));
    if (!b) continue;
    if (e.kind === "income") b.outras += e.amount_cents;
    else b.despesas += e.amount_cents;
  }

  for (const b of byMonth.values()) {
    b.receitas = b.mensalidades + b.pts + b.loja + b.outras;
    b.resultado = b.receitas - b.despesas;
  }

  const inSelected = (e: FinanceEntry) => monthOf(e.entry_date) === selected;
  const byDateDesc = (a: FinanceEntry, b: FinanceEntry) =>
    b.entry_date.localeCompare(a.entry_date);

  const profs = (profilesRes.data ?? []).filter((p) => !p.is_admin);
  const selPrefix = selected.slice(0, 7);

  return {
    months: months.map((m) => byMonth.get(m)!),
    current: byMonth.get(selected)!,
    incomeEntries: allEntries
      .filter((e) => e.kind === "income" && inSelected(e))
      .sort(byDateDesc),
    expenseEntries: allEntries
      .filter((e) => e.kind === "expense" && inSelected(e))
      .sort(byDateDesc),
    alunos: {
      ativos: profs.filter((p) => p.approved && !p.is_blocked).length,
      pausa: profs.filter((p) => p.is_blocked).length,
      novos: profs.filter(
        (p) => ((p.joined_at as string) ?? "").slice(0, 7) === selPrefix,
      ).length,
      total: profs.length,
    },
  };
}
