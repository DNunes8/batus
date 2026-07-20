import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getFinances, type FinanceMonth } from "@/lib/finances";
import { formatEuro, formatMonthYear } from "@/lib/money";
import { todayLisbon } from "@/lib/schedule";
import { FinanceLog } from "./finance-log";

export const dynamic = "force-dynamic";

function shiftMonth(monthIso: string, delta: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function lastDayOfMonth(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function parseMonth(input: string | undefined): string {
  if (input && /^\d{4}-\d{2}(-\d{2})?$/.test(input)) return `${input.slice(0, 7)}-01`;
  return `${todayLisbon().slice(0, 7)}-01`;
}

function signed(cents: number): string {
  return `${cents > 0 ? "+" : ""}${formatEuro(cents)}`;
}

const PT_MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export default async function FinancasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonth(params.month);
  const { current, months, incomeEntries, expenseEntries, alunos } =
    await getFinances(month);

  const today = todayLisbon();
  const isCurrentMonth = month === `${today.slice(0, 7)}-01`;
  // New entries default to today (current month) or the month's last day (past).
  const defaultDate = isCurrentMonth ? today : lastDayOfMonth(month);

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const revenues: Array<{ label: string; value: number }> = [
    { label: "Mensalidades", value: current.mensalidades },
    { label: "PTs", value: current.pts },
    { label: "Loja", value: current.loja },
    { label: "Outras", value: current.outras },
  ].filter((r) => r.value > 0);
  const revMax = Math.max(1, ...revenues.map((r) => r.value));
  const trendMax = Math.max(1, ...months.map((m) => Math.abs(m.resultado)));

  const alunoStats: Array<{ n: number; label: string }> = [
    { n: alunos.ativos, label: "Ativos" },
    { n: alunos.pausa, label: "Em pausa" },
    { n: alunos.novos, label: "Novos este mês" },
    { n: alunos.total, label: "Total" },
  ];

  return (
    <div className="mx-auto max-w-lg p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Finanças
      </p>

      {/* Month picker */}
      <div className="mt-4 flex items-center justify-between">
        <Link
          href={`/admin/financas?month=${prevMonth.slice(0, 7)}`}
          aria-label="Mês anterior"
          className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-2xl tracking-[0.04em] sm:text-3xl">
          {formatMonthYear(month).toUpperCase()}
        </h1>
        <Link
          href={`/admin/financas?month=${nextMonth.slice(0, 7)}`}
          aria-label="Mês seguinte"
          className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      {/* Hero — resultado */}
      <div className="mt-4 rounded-2xl border border-border/60 p-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Resultado do mês
        </p>
        <p className="mt-3 font-display text-5xl leading-none tabular-nums">
          {signed(current.resultado)}
        </p>
        <div className="mt-5 flex border-t border-border/60 pt-4">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Receitas
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatEuro(current.receitas)}
            </p>
          </div>
          <div className="flex-1 border-l border-border/60">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Despesas
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatEuro(current.despesas)}
            </p>
          </div>
        </div>
      </div>

      {/* Receitas breakdown */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Receitas
          </h2>
          <span className="text-sm font-semibold tabular-nums">
            {formatEuro(current.receitas)}
          </span>
        </div>
        {revenues.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sem receitas registadas neste mês.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {revenues.map((r) => (
              <div key={r.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">{r.label}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatEuro(r.value)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-foreground"
                    style={{ width: `${(r.value / revMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Despesas (manual) */}
      <FinanceLog
        title="Despesas"
        kind="expense"
        total={current.despesas}
        entries={expenseEntries}
        defaultDate={defaultDate}
        minDate={month}
        maxDate={lastDayOfMonth(month)}
        addLabel="+ Adicionar despesa"
      />

      {/* Outras receitas (manual — packs, one-offs) */}
      <FinanceLog
        title="Outras receitas"
        kind="income"
        total={current.outras}
        entries={incomeEntries}
        defaultDate={defaultDate}
        minDate={month}
        maxDate={lastDayOfMonth(month)}
        addLabel="+ Adicionar receita"
      />

      {/* Tendência */}
      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Resultado · 6 meses
        </h2>
        <div className="mt-4 grid grid-cols-6 items-end gap-2" style={{ height: 100 }}>
          {months.map((m: FinanceMonth) => {
            // Height by magnitude; a loss is drawn as a hollow dashed bar so it
            // can never be mistaken for a (solid) profit of the same size.
            const mag = Math.max(3, (Math.abs(m.resultado) / trendMax) * 100);
            const isLoss = m.resultado < 0;
            const isCurrent = m.month === month;
            return (
              <div key={m.month} className="flex h-full flex-col items-center justify-end gap-1.5">
                <div
                  className={`w-3/5 rounded-t-sm ${
                    isLoss
                      ? "border border-dashed border-muted-foreground/60"
                      : isCurrent
                        ? "bg-foreground"
                        : "bg-border"
                  }`}
                  style={{ height: `${mag}%` }}
                />
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  {PT_MONTHS_SHORT[Number(m.month.slice(5, 7)) - 1]}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Alunos */}
      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Alunos
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {alunoStats.map((s) => (
            <div key={s.label} className="rounded-md border border-border/60 p-4">
              <p className="font-display text-2xl tabular-nums leading-none">
                {s.n}
              </p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-10 border-t border-dashed border-border/60 pt-5 text-xs text-muted-foreground">
        As receitas de mensalidades, PTs e loja somam-se sozinhas do que já
        registas. Aqui só escreves despesas e outras receitas (packs, one-offs).
      </p>
    </div>
  );
}
