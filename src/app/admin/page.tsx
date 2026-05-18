import Link from "next/link";
import {
  TrendingUp,
  Calendar,
  Package,
  Mail,
  ArrowRight,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatEuro, monthKey } from "@/lib/money";
import {
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

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const today = todayLisbon();
  const monthStart = monthKey(new Date());

  const [
    { data: { user } },
    todayClassesRes,
    todayBookingsRes,
    todayClosedRes,
    todayOverrideRes,
    pendingClaimsRes,
    unreadMsgRes,
    paymentsThisMonthRes,
    solosThisMonthRes,
    pendingApprovalsRes,
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
      .select("template_id, status")
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
  ]);

  const todayClasses = todayClassesRes.data ?? [];
  const todayBookings = todayBookingsRes.data ?? [];
  const todayClosed = todayClosedRes.data ?? null;
  const todayOverrides = todayOverrideRes.data ?? [];
  const pendingClaims = pendingClaimsRes.count ?? 0;
  const unreadMessages = unreadMsgRes.count ?? 0;
  const pendingApprovals = pendingApprovalsRes.count ?? 0;

  const monthEarnings =
    (paymentsThisMonthRes.data ?? []).reduce(
      (sum, p) => sum + (p.amount_cents ?? 0),
      0,
    ) +
    (solosThisMonthRes.data ?? []).reduce(
      (sum, s) => sum + (s.price_cents ?? 0),
      0,
    );

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

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          icon={TrendingUp}
          label="Receitas este mês"
          value={formatEuro(monthEarnings)}
          href="/admin/pagamentos"
        />
        <DashboardCard
          icon={Calendar}
          label="Aulas hoje"
          value={String(todayClasses.length)}
          href="/admin/calendar"
        />
        <DashboardCard
          icon={Package}
          label="Pedidos pendentes"
          value={String(pendingClaims)}
          href="/admin/claims"
          highlight={pendingClaims > 0}
        />
        <DashboardCard
          icon={Mail}
          label="Mensagens por ler"
          value={String(unreadMessages)}
          href="/admin/messages"
          highlight={unreadMessages > 0}
        />
      </div>

      <section className="mt-12">
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
        ) : todayClasses.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Sem aulas hoje.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border/60 rounded-md border border-border/60">
            {todayClasses
              .map((t) => {
                const override = todayOverrides.find(
                  (o) => o.template_id === t.id,
                );
                const cancelled = override?.cancelled ?? false;
                const start = override?.override_start_time ?? t.start_time;
                const capacity = override?.override_capacity ?? t.capacity;
                const booked = todayBookings.filter(
                  (b) => b.template_id === t.id && b.status === "booked",
                ).length;
                const waitlist = todayBookings.filter(
                  (b) => b.template_id === t.id && b.status === "waitlisted",
                ).length;
                return { ...t, start, capacity, cancelled, booked, waitlist };
              })
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-lg tracking-wider tabular-nums">
                      {formatTime(c.start)}
                    </span>
                    <p className="font-medium">{c.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {c.cancelled
                      ? "Cancelada"
                      : `${c.booked}/${c.capacity}${
                          c.waitlist > 0 ? ` · espera ${c.waitlist}` : ""
                        }`}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Atalhos
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <ShortcutLink href="/admin/classes/new">Nova aula</ShortcutLink>
          <ShortcutLink href="/admin/sessions/new">Nova sessão 1:1</ShortcutLink>
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
