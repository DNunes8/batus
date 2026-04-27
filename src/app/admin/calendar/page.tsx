import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addDays,
  formatDayHeader,
  formatTime,
  formatWeekRange,
  getAdminWeekSchedule,
  mondayOf,
  todayLisbon,
  type AdminScheduleClass,
} from "@/lib/schedule";
import {
  cancelClassInstance,
  reopenDay,
  restoreClassInstance,
  setClosedDay,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const referenceDate = params.week ?? todayLisbon();
  const weekStart = mondayOf(referenceDate);
  const days = await getAdminWeekSchedule(weekStart);
  const todayStr = todayLisbon();
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  return (
    <div className="p-6 sm:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Calendário
          </p>
          <h1 className="mt-3 font-display text-3xl tracking-[0.04em] sm:text-4xl">
            SEMANA DE {formatWeekRange(weekStart).toUpperCase()}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            render={<Link href={`/admin/calendar?week=${prevWeek}`} />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            ←
          </Button>
          <Button
            render={<Link href={`/admin/calendar?week=${todayStr}`} />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            Hoje
          </Button>
          <Button
            render={<Link href={`/admin/calendar?week=${nextWeek}`} />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            →
          </Button>
        </div>
      </header>

      <div className="mt-10 space-y-10">
        {days.map((day) => (
          <div key={day.date}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em]">
                {formatDayHeader(day.date)}
                {day.date === todayStr && (
                  <span className="ml-2 inline-block rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] tracking-widest text-background">
                    HOJE
                  </span>
                )}
              </h2>
              {day.closed ? (
                <form action={reopenDay} className="flex items-center gap-2">
                  <input type="hidden" name="date" value={day.date} />
                  <span className="text-xs text-muted-foreground">
                    Fechado: {day.closed_reason}
                  </span>
                  <Button type="submit" variant="outline" size="sm">
                    Reabrir
                  </Button>
                </form>
              ) : (
                <form
                  action={setClosedDay}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="date" value={day.date} />
                  <Input
                    name="reason"
                    placeholder="Razão (opcional)"
                    className="h-7 w-40 text-xs"
                  />
                  <Button type="submit" variant="outline" size="sm">
                    Fechar dia
                  </Button>
                </form>
              )}
            </div>

            {!day.closed && day.classes.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Sem aulas neste dia.
              </p>
            )}

            {!day.closed && day.classes.length > 0 && (
              <div className="mt-3 space-y-3">
                {day.classes.map((c) => (
                  <ClassCard key={`${c.template_id}-${c.date}`} cls={c} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassCard({ cls }: { cls: AdminScheduleClass }) {
  return (
    <div className="rounded-md border border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-lg tracking-wider tabular-nums">
            {formatTime(cls.start_time)}
          </span>
          <div>
            <p className="font-medium">{cls.name}</p>
            <p className="text-xs text-muted-foreground">
              {cls.duration_minutes} min ·{" "}
              {cls.cancelled
                ? "Cancelada"
                : `${cls.booked_count}/${cls.capacity}${
                    cls.waitlist_count > 0
                      ? ` · espera ${cls.waitlist_count}`
                      : ""
                  }`}
            </p>
          </div>
        </div>

        {cls.cancelled ? (
          <form
            action={restoreClassInstance}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="template_id" value={cls.template_id} />
            <input type="hidden" name="instance_date" value={cls.date} />
            <span className="text-xs text-muted-foreground">
              {cls.cancellation_reason}
            </span>
            <Button type="submit" variant="outline" size="sm">
              Restaurar
            </Button>
          </form>
        ) : (
          <form
            action={cancelClassInstance}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="template_id" value={cls.template_id} />
            <input type="hidden" name="instance_date" value={cls.date} />
            <Input
              name="reason"
              placeholder="Razão (opcional)"
              className="h-7 w-40 text-xs"
            />
            <Button type="submit" variant="outline" size="sm">
              Cancelar aula
            </Button>
          </form>
        )}
      </div>

      {cls.roster.length > 0 && (
        <div className="border-t border-border/40 bg-muted/20 px-4 py-2">
          <ul className="space-y-1 text-sm">
            {cls.roster.map((r) => (
              <li
                key={r.booking_id}
                className="flex items-center justify-between"
              >
                <span>
                  {r.full_name || r.email}
                  {!r.full_name && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (sem nome)
                    </span>
                  )}
                </span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {r.status === "waitlisted"
                    ? `Espera #${r.waitlist_position}`
                    : "Marcado"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
