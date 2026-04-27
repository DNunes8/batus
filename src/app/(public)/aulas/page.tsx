import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  addDays,
  formatDayHeader,
  formatTime,
  formatWeekRange,
  getWeekSchedule,
  isClassInPast,
  mondayOf,
  safeReferenceDate,
  todayLisbon,
  type ScheduleClass,
} from "@/lib/schedule";
import { bookClass, cancelBooking } from "./actions";

export const dynamic = "force-dynamic";

export default async function AulasPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const referenceDate = safeReferenceDate(params.week);
  const weekStart = mondayOf(referenceDate);
  const days = await getWeekSchedule(weekStart);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const todayStr = todayLisbon();
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Aulas
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-[0.04em] sm:text-5xl">
            HORÁRIO
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Semana de {formatWeekRange(weekStart)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            render={<Link href={`/aulas?week=${prevWeek}`} />}
            nativeButton={false}
            variant="outline"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          <Button
            render={<Link href={`/aulas?week=${todayStr}`} />}
            nativeButton={false}
            variant="outline"
          >
            Hoje
          </Button>
          <Button
            render={<Link href={`/aulas?week=${nextWeek}`} />}
            nativeButton={false}
            variant="outline"
            aria-label="Próxima semana"
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      <p className="mt-6 text-sm text-foreground/70">
        Marca a tua aula com um clique. Podes cancelar até 4h antes. Se a aula
        estiver cheia, entras na lista de espera e somos avisados quando há
        vaga.
      </p>

      <div className="mt-10 space-y-10">
        {days.map((day) => (
          <div key={day.date}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
              {formatDayHeader(day.date)}
              {day.date === todayStr && (
                <span className="ml-2 inline-block rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] tracking-widest text-background">
                  HOJE
                </span>
              )}
            </h2>

            {day.closed ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Fechado — {day.closed_reason}
              </p>
            ) : day.classes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Sem aulas neste dia.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60 rounded-md border border-border/60">
                {day.classes.map((c) => (
                  <li
                    key={`${c.template_id}-${c.date}`}
                    className="flex flex-wrap items-center justify-between gap-4 px-4 py-4"
                  >
                    <div className="flex items-baseline gap-4">
                      <span className="font-display text-xl tracking-wider tabular-nums">
                        {formatTime(c.start_time)}
                      </span>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.duration_minutes} min ·{" "}
                          {c.cancelled
                            ? "Cancelada"
                            : `${c.booked_count}/${c.capacity}${
                                c.waitlist_count > 0
                                  ? ` · lista ${c.waitlist_count}`
                                  : ""
                              }`}
                        </p>
                      </div>
                    </div>
                    <BookingControl
                      cls={c}
                      isLoggedIn={!!user}
                      isPast={isClassInPast(c.date, c.start_time)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function BookingControl({
  cls,
  isLoggedIn,
  isPast,
}: {
  cls: ScheduleClass;
  isLoggedIn: boolean;
  isPast: boolean;
}) {
  if (cls.cancelled) {
    return (
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        {cls.cancellation_reason ?? "Cancelada"}
      </span>
    );
  }

  if (isPast) {
    if (cls.user_booking_status === "booked") {
      return (
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Marcado · passou
        </span>
      );
    }
    return (
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        Passou
      </span>
    );
  }

  if (!isLoggedIn) {
    return (
      <Button
        render={<Link href="/login?next=/aulas" />}
        nativeButton={false}
        variant="outline"
        size="sm"
      >
        Entrar para marcar
      </Button>
    );
  }

  if (cls.user_booking_status === "booked") {
    return (
      <form action={cancelBooking} className="flex items-center gap-2">
        <input type="hidden" name="booking_id" value={cls.user_booking_id} />
        <span className="text-xs uppercase tracking-widest text-foreground">
          Marcado
        </span>
        <Button type="submit" variant="outline" size="sm">
          Cancelar
        </Button>
      </form>
    );
  }

  if (cls.user_booking_status === "waitlisted") {
    return (
      <form action={cancelBooking} className="flex items-center gap-2">
        <input type="hidden" name="booking_id" value={cls.user_booking_id} />
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Lista de espera
          {cls.user_waitlist_position
            ? ` · #${cls.user_waitlist_position}`
            : ""}
        </span>
        <Button type="submit" variant="outline" size="sm">
          Sair
        </Button>
      </form>
    );
  }

  const isFull = cls.booked_count >= cls.capacity;

  return (
    <form action={bookClass}>
      <input type="hidden" name="template_id" value={cls.template_id} />
      <input type="hidden" name="instance_date" value={cls.date} />
      <Button type="submit" size="sm">
        {isFull ? "Lista de espera" : "Marcar"}
      </Button>
    </form>
  );
}
