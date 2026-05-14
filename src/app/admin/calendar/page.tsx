import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/confirm-form";
import { AddClassDialog } from "@/components/admin/add-class-dialog";
import { CloseDayDialog } from "@/components/admin/close-day-dialog";
import { RescheduleDialog } from "@/components/admin/reschedule-dialog";
import { formatEuro } from "@/lib/money";
import {
  addDays,
  formatWeekRange,
  formatTime,
  getAdminWeekSchedule,
  mondayOf,
  safeReferenceDate,
  todayLisbon,
  type AdminGroupEntry,
  type AdminSoloEntry,
  type AdminScheduleDay,
} from "@/lib/schedule";
import {
  reopenDay,
  restoreClassInstance,
  cancelClassInstance,
  cancelSoloInstance,
  restoreSoloInstance,
} from "./actions";

export const dynamic = "force-dynamic";

const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_LONG = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const MONTH_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function dayNumber(s: string): number {
  return Number(s.split("-")[2]);
}

function monthIndex(s: string): number {
  // YYYY-MM-DD → 0-based month index for MONTH_SHORT lookup.
  return Number(s.split("-")[1]) - 1;
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; day?: string }>;
}) {
  const params = await searchParams;
  const referenceDate = safeReferenceDate(params.week);
  const weekStart = mondayOf(referenceDate);
  const days = await getAdminWeekSchedule(weekStart);
  const todayStr = todayLisbon();
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  // Selected day for the mobile/tablet "one day at a time" view.
  // Priority: ?day= if it's in this week → today if it's in this week → weekStart.
  // Keeps the URL stable so navigation between weeks doesn't lose context.
  const dayInWeek = params.day && days.find((d) => d.date === params.day);
  const todayInWeek = days.find((d) => d.date === todayStr);
  const selectedDate = dayInWeek
    ? dayInWeek.date
    : (todayInWeek?.date ?? weekStart);
  const selectedDay = days.find((d) => d.date === selectedDate) ?? days[0];

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
            className="h-10 w-10 p-0 sm:h-9 sm:w-auto sm:px-3"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          <Button
            render={<Link href={`/admin/calendar?week=${todayStr}`} />}
            nativeButton={false}
            variant="outline"
            className="h-10 px-4 sm:h-9 sm:px-3"
          >
            Hoje
          </Button>
          <Button
            render={<Link href={`/admin/calendar?week=${nextWeek}`} />}
            nativeButton={false}
            variant="outline"
            aria-label="Próxima semana"
            className="h-10 w-10 p-0 sm:h-9 sm:w-auto sm:px-3"
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      {/* Week strip (mobile + tablet). The whole week visible on one row;
          tap a day to switch the expanded view below. */}
      <div className="mt-6 xl:hidden">
        <WeekStrip
          days={days}
          weekStart={weekStart}
          selectedDate={selectedDate}
          todayStr={todayStr}
        />
      </div>

      {/* Expanded selected day (mobile + tablet). One day, full detail. */}
      <div className="mt-4 xl:hidden">
        <ExpandedDayCard day={selectedDay} todayStr={todayStr} />
      </div>

      {/* Seven-column grid (desktop only). At xl+ the screen is wide enough
          to scan the whole week at a glance — the strip becomes redundant. */}
      <div className="mt-8 hidden grid-cols-7 gap-3 xl:grid">
        {days.map((day) => (
          <DayCard key={day.date} day={day} todayStr={todayStr} />
        ))}
      </div>
    </div>
  );
}

function WeekStrip({
  days,
  weekStart,
  selectedDate,
  todayStr,
}: {
  days: AdminScheduleDay[];
  weekStart: string;
  selectedDate: string;
  todayStr: string;
}) {
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const isToday = day.date === todayStr;
        const count = day.entries.filter((e) => !e.cancelled).length;

        return (
          <Link
            key={day.date}
            href={`/admin/calendar?week=${weekStart}&day=${day.date}`}
            scroll={false}
            aria-label={`${DAY_LONG[day.day_of_week]} ${dayNumber(day.date)}${
              day.closed ? " (fechado)" : ""
            }${count ? ` (${count} ${count === 1 ? "aula" : "aulas"})` : ""}`}
            className={`flex flex-col items-center gap-0.5 rounded-md border px-1 py-2 transition-colors ${
              isSelected
                ? "border-foreground bg-foreground text-background"
                : isToday
                  ? "border-foreground/40 hover:bg-muted/40"
                  : "border-border/60 hover:bg-muted/40"
            }`}
          >
            <span
              className={`text-[9px] uppercase tracking-wider ${
                isSelected
                  ? "text-background/70"
                  : "text-muted-foreground"
              }`}
            >
              {DAY_SHORT[day.day_of_week]}
            </span>
            <span
              className={`font-display text-lg leading-none tabular-nums sm:text-xl ${
                isSelected ? "text-background" : "text-foreground"
              }`}
            >
              {dayNumber(day.date)}
            </span>
            <span
              className={`text-[10px] tabular-nums ${
                isSelected
                  ? "text-background/70"
                  : "text-muted-foreground"
              }`}
              aria-hidden
            >
              {day.closed ? "✕" : count > 0 ? count : "·"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// Expanded view of the selected day — used on mobile + tablet. Same building
// blocks as DayCard but with a larger header, no min-height, and roomier
// padding so it doesn't feel cramped at full width.
function ExpandedDayCard({
  day,
  todayStr,
}: {
  day: AdminScheduleDay;
  todayStr: string;
}) {
  const isToday = day.date === todayStr;

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-background ${
        isToday ? "border-foreground" : "border-border/60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-border/40 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {DAY_LONG[day.day_of_week]}
          </p>
          <p className="mt-0.5 font-display text-2xl tabular-nums sm:text-3xl">
            {dayNumber(day.date)}{" "}
            <span className="text-muted-foreground">
              {MONTH_SHORT[monthIndex(day.date)]}
            </span>
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

      <div className="space-y-2 px-3 py-4 sm:px-4">
        {day.closed ? (
          <div className="py-6 text-center">
            <p className="text-xs uppercase tracking-widest text-destructive">
              Fechado
            </p>
            {day.closed_reason && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {day.closed_reason}
              </p>
            )}
          </div>
        ) : (
          <>
            {day.entries.length === 0 && (
              <p className="py-6 text-center text-sm uppercase tracking-widest text-muted-foreground">
                Sem aulas neste dia
              </p>
            )}
            {day.entries.map((entry) =>
              entry.kind === "group" ? (
                <GroupBlock
                  key={`g-${entry.template_id}-${entry.date}`}
                  entry={entry}
                />
              ) : (
                <SoloBlock
                  key={`s-${entry.template_id}-${entry.date}`}
                  entry={entry}
                />
              ),
            )}
            <div className="pt-2">
              <AddClassDialog date={day.date} />
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border/40 px-3 py-1 sm:px-4">
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
            {day.entries.length === 0 && (
              <p className="py-4 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
                Sem aulas
              </p>
            )}
            {day.entries.map((entry) =>
              entry.kind === "group" ? (
                <GroupBlock
                  key={`g-${entry.template_id}-${entry.date}`}
                  entry={entry}
                />
              ) : (
                <SoloBlock
                  key={`s-${entry.template_id}-${entry.date}`}
                  entry={entry}
                />
              ),
            )}
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

function GroupBlock({ entry }: { entry: AdminGroupEntry }) {
  if (entry.cancelled) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-base tabular-nums text-destructive line-through">
            {formatTime(entry.start_time)}
          </span>
          <span className="text-[9px] uppercase tracking-[0.15em] text-destructive">
            Cancelada
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-destructive/90">
          {entry.name}
        </p>
        {entry.cancellation_reason && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {entry.cancellation_reason}
          </p>
        )}
        <form action={restoreClassInstance} className="mt-2">
          <input type="hidden" name="template_id" value={entry.template_id} />
          <input type="hidden" name="instance_date" value={entry.date} />
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

  const isFull = entry.booked_count >= entry.capacity;

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
          {formatTime(entry.start_time)}
        </span>
        <span
          className={`text-[10px] tabular-nums ${
            isFull ? "font-medium text-foreground" : "text-muted-foreground"
          }`}
        >
          {entry.booked_count}/{entry.capacity}
          {entry.waitlist_count > 0 && ` · +${entry.waitlist_count}`}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium leading-tight">{entry.name}</p>

      {entry.roster.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          {entry.roster.slice(0, 3).map((r) => {
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
          {entry.roster.length > 3 && (
            <li className="text-muted-foreground/60">
              +{entry.roster.length - 3} mais
            </li>
          )}
        </ul>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/30 pt-1.5">
        <RescheduleDialog
          kind="group"
          template_id={entry.template_id}
          instance_date={entry.date}
          current_start_time={entry.start_time}
          label={entry.name}
        />
        <ConfirmForm
          message={`Cancelar "${entry.name}" neste dia? Os alunos com marcação vão ver-la cancelada.`}
          action={cancelClassInstance}
        >
          <input type="hidden" name="template_id" value={entry.template_id} />
          <input type="hidden" name="instance_date" value={entry.date} />
          <button
            type="submit"
            className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-destructive"
          >
            Cancelar
          </button>
        </ConfirmForm>
      </div>
    </div>
  );
}

function SoloBlock({ entry }: { entry: AdminSoloEntry }) {
  if (entry.cancelled) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-base tabular-nums text-destructive line-through">
            {formatTime(entry.start_time)}
          </span>
          <span className="text-[9px] uppercase tracking-[0.15em] text-destructive">
            Cancelada
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-destructive/90">
          1:1 · {entry.student_name}
        </p>
        {entry.cancellation_reason && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {entry.cancellation_reason}
          </p>
        )}
        <form action={restoreSoloInstance} className="mt-2">
          <input type="hidden" name="template_id" value={entry.template_id} />
          <input type="hidden" name="instance_date" value={entry.date} />
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

  return (
    <div className="rounded-md border border-gold/30 bg-gold/5 p-2.5 transition-colors hover:border-gold/60">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-base tabular-nums">
          {formatTime(entry.start_time)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-sm border border-gold/50 px-1 py-0.5 text-[9px] uppercase tracking-[0.15em] text-foreground">
          1:1
        </span>
      </div>
      <p className="mt-1 text-sm font-medium leading-tight">
        {entry.student_name}
      </p>
      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
        {entry.duration_minutes} min · {formatEuro(entry.price_cents)}
      </p>
      {entry.notes && (
        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
          {entry.notes}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-gold/20 pt-1.5">
        <RescheduleDialog
          kind="solo"
          template_id={entry.template_id}
          instance_date={entry.date}
          current_start_time={entry.start_time}
          label={`1:1 · ${entry.student_name}`}
        />
        <ConfirmForm
          message={`Cancelar 1:1 com ${entry.student_name} neste dia?`}
          action={cancelSoloInstance}
        >
          <input type="hidden" name="template_id" value={entry.template_id} />
          <input type="hidden" name="instance_date" value={entry.date} />
          <button
            type="submit"
            className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-destructive"
          >
            Cancelar
          </button>
        </ConfirmForm>
      </div>
    </div>
  );
}
