import Link from "next/link";
import { TrendingUp, Package, ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatEuro, monthKey } from "@/lib/money";
import {
  addDays,
  formatDayHeader,
  formatTime,
  todayLisbon,
} from "@/lib/schedule";

export const dynamic = "force-dynamic";

const PT_DAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function dowOf(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// "há 2h" / "ontem" / "há 3 dias" / fallback to a short date for older items.
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `há ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "ontem";
  if (diffDay < 7) return `há ${diffDay} dias`;
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
  });
}

// Single-line message preview: collapse whitespace + clip with ellipsis.
function previewText(text: string, maxLen = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLen) return flat;
  return `${flat.slice(0, maxLen).trimEnd()}…`;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const today = todayLisbon();
  const monthStart = monthKey(new Date());
  // Month end + cutoff (min of month-end and today), used to walk recurring PT
  // revenue the same way the Pagamentos page does.
  const [myYear, myMonth] = monthStart.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(myYear, myMonth, 0))
    .toISOString()
    .slice(0, 10);
  const activityCutoff = monthEnd < today ? monthEnd : today;

  const [
    { data: { user } },
    todayClassesRes,
    todayBookingsRes,
    todayClosedRes,
    todayOverrideRes,
    pendingClaimsRes,
    unreadMsgRes,
    latestMessagesRes,
    paymentsThisMonthRes,
    solosThisMonthRes,
    pendingApprovalsRes,
    birthdaysRes,
    soloTemplatesRes,
    soloOverridesRes,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("class_templates")
      .select("id, name, start_time, duration_minutes, capacity, day_of_week, active_from, active_until")
      .eq("day_of_week", dowOf(today))
      .lte("active_from", today)
      .or(`active_until.is.null,active_until.gte.${today}`),
    admin
      .from("bookings")
      .select(
        "template_id, status, profile:profiles(full_name, email)",
      )
      .eq("instance_date", today)
      .in("status", ["booked", "waitlisted"]),
    supabase.from("closed_days").select("reason").eq("date", today).maybeSingle(),
    supabase
      .from("class_overrides")
      .select("template_id, cancelled, override_start_time, override_capacity, reason")
      .eq("instance_date", today),
    admin.from("merch_claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
    // Preview of the 3 most-recent unread messages so the coach can triage
    // straight from the dashboard without opening /admin/messages.
    admin
      .from("contact_messages")
      .select("id, name, message, created_at")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(3),
    admin
      .from("payment_records")
      .select("amount_cents")
      .gte("month", monthStart)
      .eq("status", "paid"),
    admin
      .from("solo_sessions")
      .select("price_cents")
      .gte("session_date", `${monthStart}T00:00:00`),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("approved", false)
      .eq("is_admin", false),
    // All approved students with a birthday on file. We filter to "today" in
    // JS below — PostgREST doesn't expose extract(month/day), and the studio
    // is small enough that fetching the whole list is trivial.
    admin
      .from("profiles")
      .select("id, full_name, phone, birthday")
      .not("birthday", "is", null)
      .eq("approved", true)
      .eq("is_admin", false),
    admin
      .from("solo_session_templates")
      .select(
        "id, user_id, day_of_week, price_cents, active_from, active_until, is_preset",
      ),
    admin
      .from("solo_session_overrides")
      .select("template_id, instance_date, cancelled")
      .gte("instance_date", monthStart),
  ]);

  const todayClasses = todayClassesRes.data ?? [];
  const todayBookings = todayBookingsRes.data ?? [];
  const todayClosed = todayClosedRes.data ?? null;
  const todayOverrides = todayOverrideRes.data ?? [];
  const pendingClaims = pendingClaimsRes.count ?? 0;
  const unreadMessages = unreadMsgRes.count ?? 0;
  const latestMessages = latestMessagesRes.data ?? [];
  const pendingApprovals = pendingApprovalsRes.count ?? 0;

  // Current Lisbon clock time in "minutes since midnight" — used to tag the
  // today list with "Em curso" / "Próxima" / past styling.
  const nowLisbonHM = new Date().toLocaleTimeString("en-GB", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const [nowH, nowM] = nowLisbonHM.split(":").map(Number);
  const nowTimeMin = nowH * 60 + nowM;

  // Enrich today's classes with roster names + time-status, pre-sorted by
  // start time. The first non-cancelled upcoming class gets the "Próxima" tag.
  type EnrichedClass = {
    id: string;
    name: string;
    start: string;
    duration_minutes: number;
    capacity: number;
    cancelled: boolean;
    booked: number;
    waitlist: number;
    rosterNames: string[];
    timeStatus: "past" | "current" | "upcoming";
    isNext: boolean;
  };
  const enrichedTodayClasses: EnrichedClass[] = todayClasses
    .map((t): EnrichedClass => {
      const override = todayOverrides.find((o) => o.template_id === t.id);
      const cancelled = override?.cancelled ?? false;
      const start = override?.override_start_time ?? t.start_time;
      const capacity = override?.override_capacity ?? t.capacity;
      const matching = todayBookings.filter((b) => b.template_id === t.id);
      const booked = matching.filter((b) => b.status === "booked").length;
      const waitlist = matching.filter((b) => b.status === "waitlisted").length;
      const rosterNames = matching
        .filter((b) => b.status === "booked")
        .map((b) => {
          const p = b.profile as unknown as {
            full_name: string | null;
            email: string;
          } | null;
          return p?.full_name?.trim() || p?.email?.split("@")[0] || "—";
        });
      const [sH, sM] = start.split(":").map(Number);
      const startMin = sH * 60 + sM;
      const endMin = startMin + t.duration_minutes;
      const timeStatus: "past" | "current" | "upcoming" = cancelled
        ? "past"
        : nowTimeMin < startMin
          ? "upcoming"
          : nowTimeMin <= endMin
            ? "current"
            : "past";
      return {
        id: t.id,
        name: t.name,
        start,
        duration_minutes: t.duration_minutes,
        capacity,
        cancelled,
        booked,
        waitlist,
        rosterNames,
        timeStatus,
        isNext: false,
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  const nextIdx = enrichedTodayClasses.findIndex(
    (c) => c.timeStatus === "upcoming" && !c.cancelled,
  );
  if (nextIdx >= 0) enrichedTodayClasses[nextIdx].isNext = true;

  // Today's birthdays: same month + day as today (Lisbon). Age is current
  // year minus birth year, clipped to 0 in case someone typed a future year.
  const todayMMDD = today.slice(5); // "MM-DD"
  const birthdaysToday = (birthdaysRes.data ?? [])
    .filter((p) => p.birthday && p.birthday.slice(5) === todayMMDD)
    .map((p) => ({
      ...p,
      age: Math.max(0, Number(today.slice(0, 4)) - Number(p.birthday!.slice(0, 4))),
    }))
    .sort((a, b) =>
      (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt"),
    );

  // Recurring PT revenue this month — mirrors the Pagamentos page so the
  // dashboard total isn't undercounted. Walk each active recurring template
  // weekly from month start to today, skipping presets + cancelled overrides.
  const soloTemplates = soloTemplatesRes.data ?? [];
  const soloOverrides = soloOverridesRes.data ?? [];
  let recurringPtCents = 0;
  for (const tpl of soloTemplates) {
    if (tpl.is_preset || !tpl.user_id) continue;
    if (tpl.active_from > monthEnd) continue;
    if (tpl.active_until && tpl.active_until < monthStart) continue;
    const start = tpl.active_from > monthStart ? tpl.active_from : monthStart;
    const end =
      tpl.active_until && tpl.active_until < activityCutoff
        ? tpl.active_until
        : activityCutoff;
    let cursor = start;
    while (cursor <= end && dowOf(cursor) !== tpl.day_of_week) {
      cursor = addDays(cursor, 1);
    }
    while (cursor <= end) {
      const ov = soloOverrides.find(
        (o) => o.template_id === tpl.id && o.instance_date === cursor,
      );
      if (!ov?.cancelled) {
        recurringPtCents += tpl.price_cents ?? 0;
      }
      cursor = addDays(cursor, 7);
    }
  }

  const monthEarnings =
    (paymentsThisMonthRes.data ?? []).reduce(
      (sum, p) => sum + (p.amount_cents ?? 0),
      0,
    ) +
    (solosThisMonthRes.data ?? []).reduce(
      (sum, s) => sum + (s.price_cents ?? 0),
      0,
    ) +
    recurringPtCents;

  const dayName = PT_DAYS[dowOf(today)];

  return (
    <div className="p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Dashboard
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        BEM-VINDO
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {user?.email} · {dayName}, {formatDayHeader(today).split(", ")[1]}
      </p>

      {/* New-account approvals — surfaced as an action item, not a stat,
          because nobody can book until the coach acts on it. */}
      {pendingApprovals > 0 && (
        <Link
          href="/admin/students"
          className="mt-8 flex items-center justify-between gap-3 rounded-md border border-foreground/30 bg-muted/40 p-4 transition-colors hover:border-foreground/50"
        >
          <div>
            <p className="text-sm font-medium">
              {pendingApprovals}{" "}
              {pendingApprovals === 1
                ? "conta nova a aguardar aprovação"
                : "contas novas a aguardar aprovação"}
            </p>
            <p className="text-xs text-muted-foreground">
              Aprova para o aluno poder marcar aulas.
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {/* Today's birthdays — surfaced as a nudge so the coach can wish the
          student in the team WhatsApp. Hidden on quiet days. */}
      {birthdaysToday.length > 0 && (
        <section className="mt-6 rounded-md border border-foreground/30 bg-muted/40 p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {birthdaysToday.length === 1
              ? "Aniversário hoje"
              : `Aniversários hoje (${birthdaysToday.length})`}
          </p>
          <ul className="mt-3 space-y-1">
            {birthdaysToday.map((p) => (
              <li key={p.id} className="text-sm">
                <Link
                  href={`/admin/students/${p.id}`}
                  className="font-medium hover:underline"
                >
                  {p.full_name || "—"}
                </Link>
                <span className="text-muted-foreground">
                  {" · "}
                  {p.age} {p.age === 1 ? "ano" : "anos"}
                  {p.phone ? ` · ${p.phone}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Hoje — first thing on opening the app. Bigger time, status chips
          ("Em curso" / "Próxima" / "Cheia") and a short roster preview so
          the coach knows who's coming without leaving the dashboard. */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Hoje
          </h2>
          <Link
            href="/admin/calendar"
            className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Calendário →
          </Link>
        </div>

        {todayClosed ? (
          <p className="mt-4 rounded-md border border-border/60 bg-muted/30 p-6 text-sm">
            <span className="font-medium">Estúdio fechado hoje.</span>{" "}
            <span className="text-muted-foreground">
              Razão: {todayClosed.reason}
            </span>
          </p>
        ) : enrichedTodayClasses.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Sem aulas hoje.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border/60 rounded-md border border-border/60">
            {enrichedTodayClasses.map((c) => {
              const past = c.timeStatus === "past";
              const isFull = !c.cancelled && c.booked >= c.capacity;
              const rosterPreview = c.rosterNames.slice(0, 3).join(", ");
              const rosterRemainder = c.rosterNames.length - 3;
              return (
                <li key={c.id} className="px-4 py-4">
                  <div className="flex items-baseline gap-4">
                    <span
                      className={`font-display text-2xl tabular-nums ${
                        past ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {formatTime(c.start)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p
                          className={`font-medium ${
                            past ? "text-muted-foreground" : ""
                          }`}
                        >
                          {c.name}
                        </p>
                        {c.cancelled ? (
                          <span className="inline-flex items-center rounded-sm border border-destructive/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-destructive">
                            Cancelada
                          </span>
                        ) : c.timeStatus === "current" ? (
                          <span className="inline-flex items-center gap-1 rounded-sm border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest">
                            <span className="size-1.5 rounded-full bg-gold" />
                            Em curso
                          </span>
                        ) : c.isNext ? (
                          <span className="inline-flex items-center rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-background">
                            Próxima
                          </span>
                        ) : null}
                        {isFull && (
                          <span className="inline-flex items-center rounded-sm border border-gold/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-foreground">
                            Cheia
                            {c.waitlist > 0 && ` · espera ${c.waitlist}`}
                          </span>
                        )}
                      </div>
                      {!c.cancelled && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            {c.booked}/{c.capacity}
                          </span>
                          {c.rosterNames.length > 0 && (
                            <>
                              {" · "}
                              {rosterPreview}
                              {rosterRemainder > 0 && ` +${rosterRemainder}`}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Mensagens por ler — latest unread previews so the coach can triage
          straight from the dashboard. Hidden on quiet days. */}
      {latestMessages.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Mensagens por ler ({unreadMessages})
            </h2>
            <Link
              href="/admin/messages"
              className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Ver todas →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border/60 rounded-md border border-border/60">
            {latestMessages.map((m) => (
              <li key={m.id}>
                <Link
                  href="/admin/messages"
                  className="block px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{m.name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeTime(m.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {previewText(m.message)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Quick-glance overview stats below the day-of focus. Dropped the
          Aulas/Mensagens counts — the sections above already convey them. */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <DashboardCard
          icon={TrendingUp}
          label="Receitas este mês"
          value={formatEuro(monthEarnings)}
          href="/admin/pagamentos"
        />
        <DashboardCard
          icon={Package}
          label="Pedidos pendentes"
          value={String(pendingClaims)}
          href="/admin/claims"
          highlight={pendingClaims > 0}
        />
      </div>

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Atalhos
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <ShortcutLink href="/admin/classes/new">Nova aula</ShortcutLink>
          <ShortcutLink href="/admin/classes/pts/new">Novo PT</ShortcutLink>
          <ShortcutLink href="/admin/students">Ver alunos</ShortcutLink>
          <ShortcutLink href="/admin/merch/new">Novo artigo</ShortcutLink>
        </div>
      </section>
    </div>
  );
}

function DashboardCard({
  icon: Icon,
  label,
  value,
  href,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-md border p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-sm ${
        highlight ? "border-foreground/30 bg-muted/30" : "border-border/60"
      }`}
    >
      <div className="flex items-start justify-between">
        <Icon className="size-4 text-muted-foreground" />
        <ArrowRight className="size-3.5 -translate-x-1 text-muted-foreground/50 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
    </Link>
  );
}

function ShortcutLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border/60 px-3 py-2 text-sm font-medium hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}
