import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  addDays,
  formatDayHeader,
  formatTime,
  formatWeekRange,
  getWeekSchedule,
  isClassInPast,
  safeReferenceDate,
  todayLisbon,
  type ScheduleClass,
} from "@/lib/schedule";
import { bookClass } from "./actions";
import { studio } from "@/lib/studio.config";
import { currentMonthLabel, isUnpaidAndBlocked } from "@/lib/payment";
import { getBookableUntil } from "@/lib/booking-window";

export const dynamic = "force-dynamic";

export default async function AulasPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const todayStr = todayLisbon();
  // Students get a rolling 7-day window starting today (or the requested
  // start, clamped so it never goes before today — they only book forward).
  // No Monday anchoring, so the schedule never looks empty just because it's
  // late in the calendar week. Baltaru's admin calendar keeps its own view.
  const requested = safeReferenceDate(params.week);
  const start = requested < todayStr ? todayStr : requested;
  const days = await getWeekSchedule(start);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Approval status — a logged-in but unapproved student can browse the
  // schedule but not book. Admins are always treated as approved.
  let isApproved = false;
  let isPaused = false;
  let isIncomplete = false;
  let isUnpaid = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "approved, is_admin, is_blocked, full_name, phone, birthday, has_monthly_fee, joined_at",
      )
      .eq("id", user.id)
      .maybeSingle();
    isApproved = !!profile?.approved || !!profile?.is_admin;
    isPaused = !!profile?.is_blocked && !profile?.is_admin;
    isIncomplete =
      !profile?.is_admin &&
      (!profile?.full_name || !profile?.phone || !profile?.birthday);
    // Payment gate only matters once they're otherwise bookable.
    if (profile && isApproved && !isPaused && !isIncomplete) {
      isUnpaid = await isUnpaidAndBlocked(user.id, profile);
    }
  }
  const isPending = !!user && !isApproved;

  const nextStart = addDays(start, 7);
  const monthLabel = currentMonthLabel();
  // Latest date the coach has opened for booking; classes beyond it show
  // "Abre em breve" instead of a book button.
  const bookableUntil = await getBookableUntil();

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
            Boxe e kickboxing · {formatWeekRange(start)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            render={<Link href="/aulas" />}
            nativeButton={false}
            variant="outline"
            className="h-10 px-4 sm:h-9 sm:px-3"
          >
            Hoje
          </Button>
          <Button
            render={<Link href={`/aulas?week=${nextStart}`} />}
            nativeButton={false}
            variant="outline"
            aria-label="Próximos dias"
            className="h-10 px-4 sm:h-9 sm:px-3"
          >
            Próxima
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      {isIncomplete ? (
        <div className="mt-6 rounded-md border border-foreground/25 bg-muted/40 p-4 sm:p-5">
          <p className="text-sm font-medium">
            Falta completar o teu perfil
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Precisamos do teu nome, telefone e data de nascimento antes de
            marcares aulas.{" "}
            <Link
              href="/bem-vindo"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Completar agora →
            </Link>
          </p>
        </div>
      ) : isPending ? (
        <div className="mt-6 rounded-md border border-foreground/25 bg-muted/40 p-4 sm:p-5">
          <p className="text-sm font-medium">
            A tua conta está a aguardar aprovação
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Podes ver o horário, mas só marcas aulas depois de o treinador
            aprovar a tua conta.{" "}
            <Link
              href="/perfil"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              O que falta?
            </Link>
          </p>
        </div>
      ) : isPaused ? (
        <div className="mt-6 rounded-md border border-foreground/25 bg-muted/40 p-4 sm:p-5">
          <p className="text-sm font-medium">A tua conta está em pausa</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Podes ver o horário, mas não podes marcar novas aulas enquanto a
            conta estiver em pausa.{" "}
            <Link
              href="/perfil"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Saber mais
            </Link>
          </p>
        </div>
      ) : isUnpaid ? (
        <div className="mt-6 rounded-md border border-foreground/25 bg-muted/40 p-4 sm:p-5">
          <p className="text-sm font-medium">
            Mensalidade de {monthLabel} em falta
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            As marcações ficam em pausa até acertares a mensalidade. Fala com o{" "}
            {studio.coach} e ficas logo a marcar outra vez.{" "}
            <Link
              href="/perfil"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Saber mais
            </Link>
          </p>
        </div>
      ) : (
        <p className="mt-6 max-w-2xl text-sm text-foreground/70">
          Horário aberto a todos. Marca uma aula com um clique
          {user
            ? ". Para cancelar uma marcação, vai a "
            : " (precisas de iniciar sessão). Para cancelar, vai a "}
          <Link
            href="/perfil"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Perfil
          </Link>
          .
        </p>
      )}

      {(() => {
        // The window already starts today, so every day here is upcoming —
        // just drop the empty, non-closed days.
        const visibleDays = days.filter(
          (d) => d.closed || d.classes.length > 0,
        );

        if (visibleDays.length === 0) {
          return (
            <p className="mt-12 text-sm text-muted-foreground">
              Sem aulas marcadas para os próximos dias. Vê mais à frente com{" "}
              <Link href={`/aulas?week=${nextStart}`} className="underline">
                Próxima
              </Link>{" "}
              ou contacta o estúdio.
            </p>
          );
        }

        return (
          <div className="mt-10 space-y-10">
            {visibleDays.map((day) => {
              // One class per day: does the student already hold an active
              // booking (booked or waitlisted) somewhere on this day?
              const userBookedThisDay = day.classes.some(
                (c) =>
                  c.user_booking_status === "booked" ||
                  c.user_booking_status === "waitlisted",
              );
              return (
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
                    Fechado · {day.closed_reason}
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-border/60 rounded-md border border-border/60">
                    {day.classes.map((c) => (
                      <li
                        key={`${c.template_id}-${c.date}`}
                        className="flex flex-wrap items-center justify-between gap-4 px-4 py-4"
                      >
                        <Link
                          href={`/aulas/${c.template_id}/${c.date}`}
                          className="-mx-2 flex flex-1 items-baseline gap-4 rounded px-2 py-1 transition-colors hover:bg-muted/50"
                        >
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
                        </Link>
                        <BookingControl
                          cls={c}
                          isLoggedIn={!!user}
                          isApproved={isApproved}
                          isPaused={isPaused}
                          isIncomplete={isIncomplete}
                          isUnpaid={isUnpaid}
                          notYetOpen={c.date > bookableUntil}
                          dayHasOtherBooking={
                            userBookedThisDay &&
                            c.user_booking_status !== "booked" &&
                            c.user_booking_status !== "waitlisted"
                          }
                          isPast={isClassInPast(c.date, c.start_time)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              );
            })}
          </div>
        );
      })()}
    </section>
  );
}

function BookingControl({
  cls,
  isLoggedIn,
  isApproved,
  isPaused,
  isIncomplete,
  isUnpaid,
  notYetOpen,
  dayHasOtherBooking,
  isPast,
}: {
  cls: ScheduleClass;
  isLoggedIn: boolean;
  isApproved: boolean;
  isPaused: boolean;
  isIncomplete: boolean;
  isUnpaid: boolean;
  notYetOpen: boolean;
  dayHasOtherBooking: boolean;
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

  // Beyond the window the coach has opened — visible but not bookable yet.
  if (notYetOpen) {
    return (
      <span className="inline-flex h-10 items-center rounded-md border border-border/60 px-3 text-xs uppercase tracking-widest text-muted-foreground">
        Abre em breve
      </span>
    );
  }

  if (!isLoggedIn) {
    return (
      <Button
        render={<Link href="/login?next=/aulas" />}
        nativeButton={false}
        variant="outline"
        className="h-10 px-4"
      >
        Entrar para marcar
      </Button>
    );
  }

  // Logged in but not yet approved — locked chip, never an active button.
  if (!isApproved) {
    return (
      <span className="inline-flex h-10 items-center rounded-md border border-border/60 px-3 text-xs uppercase tracking-widest text-muted-foreground">
        Aprovação pendente
      </span>
    );
  }

  if (cls.user_booking_status === "booked") {
    return (
      <span className="inline-flex h-10 items-center gap-2 rounded-md border border-foreground/30 bg-foreground/5 px-3 text-xs uppercase tracking-widest">
        <span className="size-1.5 rounded-full bg-foreground" />
        Marcado
      </span>
    );
  }

  if (cls.user_booking_status === "waitlisted") {
    return (
      <span className="inline-flex h-10 items-center gap-2 rounded-md border border-border/60 px-3 text-xs uppercase tracking-widest text-muted-foreground">
        Lista de espera
        {cls.user_waitlist_position
          ? ` · #${cls.user_waitlist_position}`
          : ""}
      </span>
    );
  }

  // Incomplete profile — name or phone still missing. The bookClass action
  // would bounce them anyway; reflect that in the button.
  if (isIncomplete) {
    return (
      <span className="inline-flex h-10 items-center rounded-md border border-border/60 px-3 text-xs uppercase tracking-widest text-muted-foreground">
        Completar perfil
      </span>
    );
  }

  // Paused account — keeps existing bookings above, but no new ones.
  if (isPaused) {
    return (
      <span className="inline-flex h-10 items-center rounded-md border border-border/60 px-3 text-xs uppercase tracking-widest text-muted-foreground">
        Conta em pausa
      </span>
    );
  }

  // Unpaid past the monthly cutoff — locked until they settle up.
  if (isUnpaid) {
    return (
      <span className="inline-flex h-10 items-center rounded-md border border-border/60 px-3 text-xs uppercase tracking-widest text-muted-foreground">
        Pagamento em falta
      </span>
    );
  }

  // One class per day — they already booked a different class this day, so this
  // one is locked. book_class enforces it server-side too (migration 0018).
  if (dayHasOtherBooking) {
    return (
      <span className="inline-flex h-10 items-center rounded-md border border-border/60 px-3 text-xs uppercase tracking-widest text-muted-foreground">
        Já tens aula neste dia
      </span>
    );
  }

  const isFull = cls.booked_count >= cls.capacity;

  return (
    <form action={bookClass}>
      <input type="hidden" name="template_id" value={cls.template_id} />
      <input type="hidden" name="instance_date" value={cls.date} />
      <SubmitButton className="h-10 px-4" pendingText="A marcar…">
        {isFull ? "Lista de espera" : "Marcar"}
      </SubmitButton>
    </form>
  );
}
