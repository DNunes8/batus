import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/confirm-form";
import { AddClassDialog } from "@/components/admin/add-class-dialog";
import { CloseDayDialog } from "@/components/admin/close-day-dialog";
import {
  addDays,
  formatWeekRange,
  formatTime,
  getAdminWeekSchedule,
  mondayOf,
  safeReferenceDate,
  todayLisbon,
  type AdminScheduleClass,
  type AdminScheduleDay,
} from "@/lib/schedule";
import { reopenDay, restoreClassInstance, cancelClassInstance } from "./actions";

export const dynamic = "force-dynamic";

const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dayNumber(s: string): number {
  return Number(s.split("-")[2]);
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const referenceDate = safeReferenceDate(params.week);
  const weekStart = mondayOf(referenceDate);
  const days = await getAdminWeekSchedule(weekStart);
  const todayStr = todayLisbon();
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Calendário
          </p>
          <h1 className="mt-3 font-display text-2xl tracking-[0.04em] sm:text-3xl">
            SEMANA DE {formatWeekRange(weekStart).toUpperCase()}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            render={<Link href={`/admin/calendar?week=${prevWeek}`} />}
            nativeButton={false}
            variant="outline"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          <Button
            render={<Link href={`/admin/calendar?week=${todayStr}`} />}
            nativeButton={false}
            variant="outline"
          >
            Hoje
          </Button>
          <Button
            render={<Link href={`/admin/calendar?week=${nextWeek}`} />}
            nativeButton={false}
            variant="outline"
            aria-label="Próxima semana"
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
        Carrega em <span className="text-foreground">+ Adicionar aula</span> em
        qualquer dia para criar uma aula avulsa ou recorrente. Cada modelo
        criado em <Link href="/admin/classes" className="underline hover:text-foreground">Modelos</Link> aparece automaticamente nos dias correspondentes.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
        {days.map((day) => (
          <DayCard key={day.date} day={day} todayStr={todayStr} />
        ))}
      </div>
    </div>
  );
}

function DayCard({
  day,
  todayStr,
}: {
  day: AdminScheduleDay;
  todayStr: string;
}) {
  const isToday = day.date === todayStr;

  return (
    <div
      className={`flex min-h-[280px] flex-col overflow-hidden rounded-lg border bg-background ${
        isToday ? "border-foreground" : "border-border/60"
      }`}
    >
      <div className="flex items-baseline justify-between border-b border-border/40 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {DAY_SHORT[day.day_of_week]}
          </p>
          <p className="mt-0.5 font-display text-3xl leading-none tabular-nums">
            {dayNumber(day.date)}
          </p>
        </div>
        {isToday && (
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-foreground px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-background">
            <span className="relative inline-flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-gold" />
            </span>
            HOJE
          </span>
        )}
      </div>

      <div className="flex-1 space-y-2 px-3 py-3">
        {day.closed ? (
          <div className="py-4 text-center">
            <p className="text-[10px] uppercase tracking-widest text-destructive">
              Fechado
            </p>
            {day.closed_reason && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {day.closed_reason}
              </p>
            )}
          </div>
        ) : (
          <>
            {day.classes.length === 0 && (
              <p className="py-4 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
                Sem aulas
              </p>
            )}
            {day.classes.map((c) => (
              <ClassBlock key={`${c.template_id}-${c.date}`} cls={c} />
            ))}
            <div className="pt-1">
              <AddClassDialog date={day.date} />
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border/40 px-3 py-1">
        {day.closed ? (
          <form action={reopenDay}>
            <input type="hidden" name="date" value={day.date} />
            <button
              type="submit"
              className="w-full py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-foreground hover:opacity-70"
            >
              Reabrir dia
            </button>
          </form>
        ) : (
          <CloseDayDialog date={day.date} />
        )}
      </div>
    </div>
  );
}

function ClassBlock({ cls }: { cls: AdminScheduleClass }) {
  if (cls.cancelled) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-base tabular-nums text-destructive line-through">
            {formatTime(cls.start_time)}
          </span>
          <span className="text-[9px] uppercase tracking-[0.15em] text-destructive">
            Cancelada
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-destructive/90">
          {cls.name}
        </p>
        {cls.cancellation_reason && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {cls.cancellation_reason}
          </p>
        )}
        <form action={restoreClassInstance} className="mt-2">
          <input type="hidden" name="template_id" value={cls.template_id} />
          <input type="hidden" name="instance_date" value={cls.date} />
          <button
            type="submit"
            className="text-[10px] uppercase tracking-[0.15em] text-foreground hover:opacity-70"
          >
            Restaurar →
          </button>
        </form>
      </div>
    );
  }

  const isFull = cls.booked_count >= cls.capacity;

  return (
    <div
      className={`rounded-md border bg-background p-2.5 transition-colors ${
        isFull
          ? "border-gold/40 bg-gold/5 hover:border-gold"
          : "border-border/40 hover:border-border"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-base tabular-nums">
          {formatTime(cls.start_time)}
        </span>
        <span
          className={`text-[10px] tabular-nums ${
            isFull ? "font-medium text-foreground" : "text-muted-foreground"
          }`}
        >
          {cls.booked_count}/{cls.capacity}
          {cls.waitlist_count > 0 && ` · +${cls.waitlist_count}`}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium leading-tight">{cls.name}</p>

      {cls.roster.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          {cls.roster.slice(0, 3).map((r) => {
            const name = r.full_name || r.email.split("@")[0];
            return (
              <li
                key={r.booking_id}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="truncate">{name}</span>
                {r.status === "waitlisted" && (
                  <span className="shrink-0 text-[9px]">
                    espera #{r.waitlist_position}
                  </span>
                )}
              </li>
            );
          })}
          {cls.roster.length > 3 && (
            <li className="text-muted-foreground/60">
              +{cls.roster.length - 3} mais
            </li>
          )}
        </ul>
      )}

      <ConfirmForm
        message={`Cancelar "${cls.name}" neste dia? Os alunos com marcação vão ver-la cancelada.`}
        action={cancelClassInstance}
        className="mt-2 border-t border-border/30 pt-1.5"
      >
        <input type="hidden" name="template_id" value={cls.template_id} />
        <input type="hidden" name="instance_date" value={cls.date} />
        <button
          type="submit"
          className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-destructive"
        >
          Cancelar aula
        </button>
      </ConfirmForm>
    </div>
  );
}
