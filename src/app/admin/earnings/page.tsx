import { createAdminClient } from "@/lib/supabase/admin";
import { formatEuro, formatMonthYear, monthKey } from "@/lib/money";
import { addDays, dayOfWeek, todayLisbon } from "@/lib/schedule";

export const dynamic = "force-dynamic";

type MonthlyTotals = {
  month: string; // YYYY-MM-01
  payments_cents: number;
  solos_cents: number;
};

function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  now.setUTCDate(1);
  for (let i = 0; i < n; i++) {
    months.unshift(monthKey(now));
    now.setUTCMonth(now.getUTCMonth() - 1);
  }
  return months;
}

export default async function EarningsPage() {
  const admin = createAdminClient();

  const months = lastNMonths(6);
  const oldestMonth = months[0];
  const today = todayLisbon();

  const [
    paymentsRes,
    oneOffSolosRes,
    soloTemplatesRes,
    soloOverridesRes,
  ] = await Promise.all([
    admin
      .from("payment_records")
      .select("month, amount_cents, paid_at")
      .gte("month", oldestMonth)
      .not("paid_at", "is", null),
    admin
      .from("solo_sessions")
      .select("session_date, price_cents")
      .gte("session_date", `${oldestMonth}T00:00:00`),
    admin
      .from("solo_session_templates")
      .select("id, day_of_week, price_cents, active_from, active_until")
      .lte("active_from", today),
    admin
      .from("solo_session_overrides")
      .select("template_id, instance_date, cancelled")
      .gte("instance_date", oldestMonth)
      .lte("instance_date", today),
  ]);

  const totals: Record<string, MonthlyTotals> = {};
  for (const m of months) {
    totals[m] = { month: m, payments_cents: 0, solos_cents: 0 };
  }

  for (const row of paymentsRes.data ?? []) {
    const m = row.month;
    if (totals[m]) totals[m].payments_cents += row.amount_cents ?? 0;
  }

  // One-off solos (legacy /admin/sessions/new entries)
  for (const row of oneOffSolosRes.data ?? []) {
    const sessionMonth = monthKey(new Date(row.session_date));
    if (totals[sessionMonth]) {
      totals[sessionMonth].solos_cents += row.price_cents ?? 0;
    }
  }

  // Recurring 1:1 instances: generate occurrences from templates,
  // skip cancelled ones via overrides, sum at the template price.
  const soloOverrides = soloOverridesRes.data ?? [];
  for (const tpl of soloTemplatesRes.data ?? []) {
    const startDate =
      tpl.active_from > oldestMonth ? tpl.active_from : oldestMonth;
    const endDate =
      tpl.active_until && tpl.active_until < today ? tpl.active_until : today;

    // Advance to first matching day-of-week
    let cursor = startDate;
    while (cursor <= endDate && dayOfWeek(cursor) !== tpl.day_of_week) {
      cursor = addDays(cursor, 1);
    }

    while (cursor <= endDate) {
      const ov = soloOverrides.find(
        (o) => o.template_id === tpl.id && o.instance_date === cursor,
      );
      if (!ov?.cancelled) {
        const m = `${cursor.slice(0, 7)}-01`;
        if (totals[m]) totals[m].solos_cents += tpl.price_cents ?? 0;
      }
      cursor = addDays(cursor, 7);
    }
  }

  const ordered = months.map((m) => totals[m]);
  const currentMonth = ordered[ordered.length - 1];
  const totalCurrent =
    currentMonth.payments_cents + currentMonth.solos_cents;
  const total6m = ordered.reduce(
    (sum, m) => sum + m.payments_cents + m.solos_cents,
    0,
  );

  const max = Math.max(
    1,
    ...ordered.map((m) => m.payments_cents + m.solos_cents),
  );

  return (
    <div className="p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Receitas
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        RECEITAS
      </h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-border/60 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Este mês
          </p>
          <p className="mt-2 font-display text-4xl tabular-nums">
            {formatEuro(totalCurrent)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatEuro(currentMonth.payments_cents)} mensalidades ·{" "}
            {formatEuro(currentMonth.solos_cents)} 1:1s
          </p>
        </div>
        <div className="rounded-md border border-border/60 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Últimos 6 meses
          </p>
          <p className="mt-2 font-display text-4xl tabular-nums">
            {formatEuro(total6m)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Média {formatEuro(Math.round(total6m / 6))} / mês
          </p>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Histórico mensal
        </h2>
        <div className="mt-4 space-y-3">
          {ordered.map((m) => {
            const total = m.payments_cents + m.solos_cents;
            const widthPct = (total / max) * 100;
            return (
              <div key={m.month} className="grid grid-cols-[8rem_1fr_8rem] items-center gap-3">
                <span className="text-sm">{formatMonthYear(m.month)}</span>
                <div className="h-6 overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full bg-foreground"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="text-right text-sm tabular-nums">
                  {formatEuro(total)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="mt-12 text-xs text-muted-foreground">
        Apenas pagamentos marcados como pagos contam para os totais. Sessões 1:1
        contam pelo valor registado, independente de marcação de pago.
      </p>
    </div>
  );
}
