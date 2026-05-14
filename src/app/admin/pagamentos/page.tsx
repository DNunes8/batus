import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEuro, formatMonthYear, monthKey } from "@/lib/money";
import { addDays, dayOfWeek, todayLisbon } from "@/lib/schedule";
import { PaymentsBoard, type BoardRow } from "./payments-board";
import { DefaultFeeButton } from "./default-fee-button";
import type { PaymentStatus } from "./actions";
import type { HistoryCell } from "./history-strip";

export const dynamic = "force-dynamic";

// Returns the YYYY-MM-01 month string `n` months before the input month.
function shiftMonth(monthIso: string, delta: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
}

function parseMonthParam(input: string | undefined): string {
  // Accepts "YYYY-MM" or "YYYY-MM-01". Defaults to current month.
  if (input && /^\d{4}-\d{2}(-\d{2})?$/.test(input)) {
    return `${input.slice(0, 7)}-01`;
  }
  const now = new Date();
  return monthKey(now);
}

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const selectedMonth = parseMonthParam(params.month);
  const oldestMonth = shiftMonth(selectedMonth, -5);

  const admin = createAdminClient();

  // ---- Pull everything we need in parallel ----
  const [
    profilesRes,
    recordsRes,
    settingRes,
    oneOffSolosRes,
    soloTemplatesRes,
    soloOverridesRes,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, email, full_name, phone, monthly_fee_cents, goals, notes, joined_at, is_admin, is_blocked",
      )
      .eq("is_admin", false)
      .eq("is_blocked", false),
    admin
      .from("payment_records")
      .select("id, user_id, month, amount_cents, status, paid_at, notes")
      .gte("month", oldestMonth)
      .lte("month", selectedMonth),
    admin
      .from("settings")
      .select("value")
      .eq("key", "default_monthly_fee_cents")
      .single(),
    admin
      .from("solo_sessions")
      .select("session_date, price_cents")
      .gte("session_date", `${oldestMonth}T00:00:00`),
    admin
      .from("solo_session_templates")
      .select("id, day_of_week, price_cents, active_from, active_until"),
    admin
      .from("solo_session_overrides")
      .select("template_id, instance_date, cancelled")
      .gte("instance_date", oldestMonth),
  ]);

  const profiles = profilesRes.data ?? [];
  const allRecords = recordsRes.data ?? [];
  const defaultFee = Number(settingRes.data?.value ?? 0);

  // Build the 6-month window (oldest → selected).
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(selectedMonth, -i));

  // Index records by user + month for fast lookup.
  const recordsByUser = new Map<
    string,
    Map<string, (typeof allRecords)[number]>
  >();
  for (const r of allRecords) {
    const map = recordsByUser.get(r.user_id) ?? new Map();
    map.set(r.month, r);
    recordsByUser.set(r.user_id, map);
  }

  // Compose per-student rows for the selected month.
  const rows: BoardRow[] = profiles
    .map((p) => {
      const userRecords = recordsByUser.get(p.id);
      const currentRecord = userRecords?.get(selectedMonth) ?? null;
      const resolvedFee = p.monthly_fee_cents ?? defaultFee;
      const effectiveStatus: PaymentStatus =
        (currentRecord?.status as PaymentStatus | undefined) ?? "unpaid";

      const history: HistoryCell[] = months.map((m) => {
        const rec = userRecords?.get(m);
        return {
          month: m,
          status: rec ? (rec.status as PaymentStatus) : null,
        };
      });

      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        goals: p.goals,
        notes: p.notes,
        joined_at: p.joined_at,
        record: currentRecord
          ? {
              status: currentRecord.status as PaymentStatus,
              amount_cents: currentRecord.amount_cents,
              notes: currentRecord.notes,
            }
          : null,
        resolvedFee,
        history,
        effectiveStatus,
      };
    })
    // Sort: unpaid first (action items), then paid, then paused. Within each
    // group, alphabetical by name.
    .sort((a, b) => {
      const order: Record<PaymentStatus, number> = {
        unpaid: 0,
        paid: 1,
        paused: 2,
      };
      const diff = order[a.effectiveStatus] - order[b.effectiveStatus];
      if (diff !== 0) return diff;
      const an = (a.full_name ?? a.email).toLowerCase();
      const bn = (b.full_name ?? b.email).toLowerCase();
      return an.localeCompare(bn, "pt");
    });

  // ---- Stats for the selected month ----
  const paid = rows.filter((r) => r.effectiveStatus === "paid").length;
  const unpaid = rows.filter((r) => r.effectiveStatus === "unpaid").length;
  const paused = rows.filter((r) => r.effectiveStatus === "paused").length;

  const expectedCents = rows
    .filter((r) => r.effectiveStatus !== "paused")
    .reduce((sum, r) => sum + (r.record?.amount_cents ?? r.resolvedFee), 0);
  const receivedCents = rows
    .filter((r) => r.effectiveStatus === "paid")
    .reduce((sum, r) => sum + (r.record?.amount_cents ?? r.resolvedFee), 0);

  // ---- Earnings chart (last 6 months: mensalidades + solos) ----
  type MonthlyTotals = {
    month: string;
    payments_cents: number;
    solos_cents: number;
  };
  const totals: Record<string, MonthlyTotals> = {};
  for (const m of months) {
    totals[m] = { month: m, payments_cents: 0, solos_cents: 0 };
  }

  for (const r of allRecords) {
    if (r.status === "paid" && totals[r.month]) {
      totals[r.month].payments_cents += r.amount_cents ?? 0;
    }
  }

  // One-off solo sessions (from /admin/sessions/new — kept for legacy).
  for (const row of oneOffSolosRes.data ?? []) {
    const sessionMonth = monthKey(new Date(row.session_date));
    if (totals[sessionMonth]) {
      totals[sessionMonth].solos_cents += row.price_cents ?? 0;
    }
  }

  // Recurring 1:1 instances: generate occurrences from templates, skip
  // cancelled overrides, sum at the template price.
  const today = todayLisbon();
  const soloOverrides = soloOverridesRes.data ?? [];
  for (const tpl of soloTemplatesRes.data ?? []) {
    const startDate =
      tpl.active_from > oldestMonth ? tpl.active_from : oldestMonth;
    const endDate =
      tpl.active_until && tpl.active_until < today ? tpl.active_until : today;
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

  const orderedTotals = months.map((m) => totals[m]);
  const total6m = orderedTotals.reduce(
    (s, m) => s + m.payments_cents + m.solos_cents,
    0,
  );
  const chartMax = Math.max(
    1,
    ...orderedTotals.map((m) => m.payments_cents + m.solos_cents),
  );

  const prevMonth = shiftMonth(selectedMonth, -1);
  const nextMonth = shiftMonth(selectedMonth, 1);

  return (
    <div className="p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Pagamentos
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        MENSALIDADES
      </h1>

      {/* Month picker */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div className="flex items-center gap-1">
          <Link
            href={`/admin/pagamentos?month=${prevMonth.slice(0, 7)}`}
            aria-label="Mês anterior"
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <p className="min-w-[8rem] text-center font-display text-lg tracking-[0.04em] sm:text-xl">
            {formatMonthYear(selectedMonth).toUpperCase()}
          </p>
          <Link
            href={`/admin/pagamentos?month=${nextMonth.slice(0, 7)}`}
            aria-label="Mês seguinte"
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>
        <DefaultFeeButton currentCents={defaultFee} />
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Pagos"
          value={`${paid}/${rows.length - paused}`}
          tone="emerald"
        />
        <StatCard label="Por pagar" value={`${unpaid}`} tone="rose" />
        <StatCard label="Em pausa" value={`${paused}`} tone="amber" />
        <StatCard
          label="Recebido este mês"
          value={formatEuro(receivedCents)}
          sub={`de ${formatEuro(expectedCents)}`}
        />
      </div>

      {/* Board */}
      {rows.length === 0 ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Sem alunos ativos para mostrar.
        </p>
      ) : (
        <PaymentsBoard rows={rows} month={selectedMonth} />
      )}

      {/* Earnings history */}
      <section className="mt-16 border-t border-border/40 pt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Receitas dos últimos 6 meses
          </h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            Total {formatEuro(total6m)}
          </p>
        </div>
        <div className="mt-4 space-y-3">
          {orderedTotals.map((m) => {
            const total = m.payments_cents + m.solos_cents;
            const widthPct = (total / chartMax) * 100;
            return (
              <div
                key={m.month}
                className="grid grid-cols-[6rem_1fr_6rem] items-center gap-3 sm:grid-cols-[8rem_1fr_8rem]"
              >
                <span className="truncate text-xs sm:text-sm">
                  {formatMonthYear(m.month)}
                </span>
                <div className="h-5 overflow-hidden rounded-sm bg-muted sm:h-6">
                  <div
                    className="h-full bg-foreground"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="text-right text-xs tabular-nums sm:text-sm">
                  {formatEuro(total)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Apenas mensalidades marcadas como pagas contam. 1:1s contam pelo valor
          do modelo.
        </p>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "emerald" | "rose" | "amber";
}) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "rose"
        ? "border-rose-500/30 bg-rose-500/5"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-border/60";
  return (
    <div className={`rounded-md border p-4 ${toneCls}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl tabular-nums sm:text-3xl">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
          {sub}
        </p>
      )}
    </div>
  );
}
