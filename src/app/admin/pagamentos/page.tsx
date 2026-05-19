import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatEuro, formatMonthYear, monthKey } from "@/lib/money";
import { addDays, dayOfWeek, todayLisbon } from "@/lib/schedule";
import { PaymentsBoard, type BoardRow } from "./payments-board";
import { SoloBoard, type SoloBoardRow } from "./solo-board";
import { DefaultFeeButton } from "./default-fee-button";
import type { PaymentStatus } from "./actions";
import type { HistoryCell } from "./history-strip";

export const dynamic = "force-dynamic";

type Tab = "grupo" | "solo";

// Returns the YYYY-MM-01 month string `n` months relative to the input.
function shiftMonth(monthIso: string, delta: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
}

function parseMonthParam(input: string | undefined): string {
  if (input && /^\d{4}-\d{2}(-\d{2})?$/.test(input)) {
    return `${input.slice(0, 7)}-01`;
  }
  const now = new Date();
  return monthKey(now);
}

// Last day of the given month, as YYYY-MM-DD.
function lastDayOfMonth(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  // Date.UTC month is 0-based; passing our 1-based m and day=0 lands on
  // the last day of the previous month, which is what we want.
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const selectedMonth = parseMonthParam(params.month);
  const tab: Tab = params.tab === "solo" ? "solo" : "grupo";
  const oldestMonth = shiftMonth(selectedMonth, -5);
  const monthStart = selectedMonth;
  const monthEnd = lastDayOfMonth(selectedMonth);

  const supabase = await createClient();

  const [
    profilesRes,
    recordsRes,
    settingRes,
    oneOffSolosRes,
    soloTemplatesRes,
    soloOverridesRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, phone, monthly_fee_cents, goals, notes, joined_at, is_admin, is_blocked, service_type, has_monthly_fee",
      )
      .eq("is_admin", false)
      .eq("is_blocked", false),
    supabase
      .from("payment_records")
      .select("id, user_id, month, amount_cents, status, paid_at, notes")
      .gte("month", oldestMonth)
      .lte("month", selectedMonth),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "default_monthly_fee_cents")
      .single(),
    supabase
      .from("solo_sessions")
      .select("user_id, session_date, price_cents")
      .gte("session_date", `${oldestMonth}T00:00:00`),
    supabase
      .from("solo_session_templates")
      .select(
        "id, user_id, day_of_week, price_cents, active_from, active_until",
      ),
    supabase
      .from("solo_session_overrides")
      .select("template_id, instance_date, cancelled")
      .gte("instance_date", oldestMonth),
  ]);

  const profiles = profilesRes.data ?? [];
  const allRecords = recordsRes.data ?? [];
  const defaultFee = Number(settingRes.data?.value ?? 0);
  const oneOffSolos = oneOffSolosRes.data ?? [];
  const soloTemplates = soloTemplatesRes.data ?? [];
  const soloOverrides = soloOverridesRes.data ?? [];

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

  // ---- Solo activity per student for the selected month ----
  // Aggregates from one-off solo_sessions AND from recurring solo_session_templates
  // (generating instances inside the month, skipping cancelled overrides).
  const today = todayLisbon();
  const activityCutoff = monthEnd < today ? monthEnd : today;

  type ActivityAcc = {
    sessions_this_month: number;
    revenue_this_month: number;
    last_session_date: string | null;
  };
  const activityByUser = new Map<string, ActivityAcc>();

  function bump(
    uid: string | null,
    date: string,
    priceCents: number,
  ) {
    if (!uid) return;
    if (date < monthStart || date > activityCutoff) return;
    const acc = activityByUser.get(uid) ?? {
      sessions_this_month: 0,
      revenue_this_month: 0,
      last_session_date: null,
    };
    acc.sessions_this_month += 1;
    acc.revenue_this_month += priceCents;
    if (!acc.last_session_date || date > acc.last_session_date) {
      acc.last_session_date = date;
    }
    activityByUser.set(uid, acc);
  }

  // One-off solo_sessions (legacy)
  for (const row of oneOffSolos) {
    const date = row.session_date.slice(0, 10);
    bump(row.user_id, date, row.price_cents ?? 0);
  }

  // Recurring solo_session_templates: walk weekly within the month, skipping cancellations.
  for (const tpl of soloTemplates) {
    if (!tpl.user_id) continue;
    if (tpl.active_from > monthEnd) continue;
    if (tpl.active_until && tpl.active_until < monthStart) continue;
    const start = tpl.active_from > monthStart ? tpl.active_from : monthStart;
    const end =
      tpl.active_until && tpl.active_until < activityCutoff
        ? tpl.active_until
        : activityCutoff;

    let cursor = start;
    while (cursor <= end && dayOfWeek(cursor) !== tpl.day_of_week) {
      cursor = addDays(cursor, 1);
    }
    while (cursor <= end) {
      const ov = soloOverrides.find(
        (o) =>
          o.template_id === tpl.id && o.instance_date === cursor,
      );
      if (!ov?.cancelled) {
        bump(tpl.user_id, cursor, tpl.price_cents ?? 0);
      }
      cursor = addDays(cursor, 7);
    }
  }

  // ---- Build rows for both tabs ----
  function buildBoardRow(
    p: (typeof profiles)[number],
  ): BoardRow {
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

    const activity = activityByUser.get(p.id);

    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      goals: p.goals,
      notes: p.notes,
      joined_at: p.joined_at,
      service_type: (p.service_type as "group" | "solo") ?? "group",
      has_monthly_fee: p.has_monthly_fee ?? true,
      record: currentRecord
        ? {
            status: currentRecord.status as PaymentStatus,
            amount_cents: currentRecord.amount_cents,
            notes: currentRecord.notes,
          }
        : null,
      resolvedFee,
      history,
      solo_activity: activity,
      effectiveStatus,
    };
  }

  const sortAlpha = (a: BoardRow, b: BoardRow) => {
    const an = (a.full_name ?? a.email).toLowerCase();
    const bn = (b.full_name ?? b.email).toLowerCase();
    return an.localeCompare(bn, "pt");
  };

  // Group tab: pay-status-first sort (unpaid → paid → paused)
  const groupRows: BoardRow[] = profiles
    .filter((p) => (p.service_type ?? "group") === "group")
    .map(buildBoardRow)
    .sort((a, b) => {
      const order: Record<PaymentStatus, number> = {
        unpaid: 0,
        paid: 1,
        paused: 2,
      };
      const diff = order[a.effectiveStatus] - order[b.effectiveStatus];
      if (diff !== 0) return diff;
      return sortAlpha(a, b);
    });

  // Solo tab: most-active-first (more sessions = top), alpha fallback
  const soloRows: SoloBoardRow[] = profiles
    .filter((p) => p.service_type === "solo")
    .map(buildBoardRow)
    .sort((a, b) => {
      const aSessions = a.solo_activity?.sessions_this_month ?? 0;
      const bSessions = b.solo_activity?.sessions_this_month ?? 0;
      if (aSessions !== bSessions) return bSessions - aSessions;
      return sortAlpha(a, b);
    });

  // ---- Stats per tab ----
  const groupPaid = groupRows.filter((r) => r.effectiveStatus === "paid").length;
  const groupUnpaid = groupRows.filter((r) => r.effectiveStatus === "unpaid").length;
  const groupPaused = groupRows.filter((r) => r.effectiveStatus === "paused").length;
  const groupExpected = groupRows
    .filter((r) => r.effectiveStatus !== "paused")
    .reduce((s, r) => s + (r.record?.amount_cents ?? r.resolvedFee), 0);
  const groupReceived = groupRows
    .filter((r) => r.effectiveStatus === "paid")
    .reduce((s, r) => s + (r.record?.amount_cents ?? r.resolvedFee), 0);

  const soloTotalSessions = soloRows.reduce(
    (s, r) => s + (r.solo_activity?.sessions_this_month ?? 0),
    0,
  );
  const soloTotalRevenue = soloRows.reduce(
    (s, r) => s + (r.solo_activity?.revenue_this_month ?? 0),
    0,
  );
  const soloMonthlyTracked = soloRows.filter((r) => r.has_monthly_fee).length;
  const soloPerSession = soloRows.length - soloMonthlyTracked;

  // ---- Earnings history chart ----
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
  for (const row of oneOffSolos) {
    const sessionMonth = monthKey(new Date(row.session_date));
    if (totals[sessionMonth]) {
      totals[sessionMonth].solos_cents += row.price_cents ?? 0;
    }
  }
  for (const tpl of soloTemplates) {
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

  const buildHref = (overrides: Partial<{ tab: Tab; month: string }>) => {
    const next = {
      tab: overrides.tab ?? tab,
      month: overrides.month ?? selectedMonth.slice(0, 7),
    };
    return `/admin/pagamentos?tab=${next.tab}&month=${next.month}`;
  };

  return (
    <div className="p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Pagamentos
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        {tab === "grupo" ? "AULAS DE GRUPO" : "PTS"}
      </h1>

      {/* Month picker */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div className="flex items-center gap-1">
          <Link
            href={buildHref({ month: prevMonth.slice(0, 7) })}
            aria-label="Mês anterior"
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <p className="min-w-[8rem] text-center font-display text-lg tracking-[0.04em] sm:text-xl">
            {formatMonthYear(selectedMonth).toUpperCase()}
          </p>
          <Link
            href={buildHref({ month: nextMonth.slice(0, 7) })}
            aria-label="Mês seguinte"
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>
        <DefaultFeeButton currentCents={defaultFee} />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-border/40" role="tablist">
        <TabLink
          href={buildHref({ tab: "grupo" })}
          active={tab === "grupo"}
          count={groupRows.length}
        >
          Aulas de grupo
        </TabLink>
        <TabLink
          href={buildHref({ tab: "solo" })}
          active={tab === "solo"}
          count={soloRows.length}
        >
          PTs
        </TabLink>
      </div>

      {/* Stats — typographic only, no cards, no colours. Numbers carry weight
          via display font + size; labels recede in muted small-caps. */}
      {tab === "grupo"
        ? groupRows.length > 0 && (
            <dl className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4 sm:gap-x-12">
              <Stat n={groupRows.length} label="alunos" />
              <Stat n={groupPaid} label="pagos" />
              <Stat n={groupUnpaid} label="por pagar" />
              {groupPaused > 0 && (
                <Stat n={groupPaused} label="em pausa" />
              )}
            </dl>
          )
        : soloRows.length > 0 && (
            <dl className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4 sm:gap-x-12">
              <Stat n={soloRows.length} label="alunos" />
              <Stat
                n={soloTotalSessions}
                label={soloTotalSessions === 1 ? "sessão" : "sessões"}
              />
              {soloMonthlyTracked > 0 && (
                <Stat n={soloMonthlyTracked} label="mensal" />
              )}
              {soloPerSession > 0 && (
                <Stat n={soloPerSession} label="à sessão" />
              )}
            </dl>
          )}

      {/* Board */}
      {tab === "grupo" ? (
        groupRows.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Sem alunos de aulas de grupo. Move algum aluno de PTs para cá pelo
            menu do perfil ou pelo drawer.
          </p>
        ) : (
          <PaymentsBoard rows={groupRows} month={selectedMonth} />
        )
      ) : soloRows.length === 0 ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Sem alunos de PTs. Move algum aluno de Aulas de grupo para cá pelo
          drawer ou pelo perfil do aluno.
        </p>
      ) : (
        <SoloBoard rows={soloRows} month={selectedMonth} />
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
          Mensalidades pagas + receita de PTs (one-off + recorrentes).
        </p>
      </section>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <dd className="font-display text-3xl tabular-nums tracking-[0.04em] sm:text-4xl">
        {n}
      </dd>
      <dt className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </dt>
    </div>
  );
}

function TabLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`relative px-4 py-3 text-sm font-medium tracking-wide transition-colors ${
        active
          ? "border-b-2 border-foreground -mb-px text-foreground"
          : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      <span
        className={`ml-2 text-[10px] tabular-nums ${
          active ? "text-muted-foreground" : "text-muted-foreground/60"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

