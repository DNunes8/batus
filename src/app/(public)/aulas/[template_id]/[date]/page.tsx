import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { WhatsAppShareButton } from "@/components/whatsapp-share-button";
import { studio } from "@/lib/studio.config";
import { currentMonthLabel, isUnpaidAndBlocked } from "@/lib/payment";
import {
  dayOfWeek,
  formatDayHeader,
  formatTime,
  isClassInPast,
  mondayOf,
} from "@/lib/schedule";
import { bookClass } from "../../actions";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Params = Promise<{ template_id: string; date: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { template_id, date } = await params;
  if (!UUID_RE.test(template_id) || !DATE_RE.test(date)) {
    return { title: `Aula · ${studio.fullName}` };
  }
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("class_templates")
    .select("name, description")
    .eq("id", template_id)
    .maybeSingle();

  if (!template) {
    return { title: `Aula · ${studio.fullName}` };
  }

  const dayLabel = formatDayHeader(date);
  const description =
    template.description ??
    `${template.name} em ${studio.city}, ${dayLabel.toLowerCase()}. Marca a tua aula online.`;

  return {
    title: `${template.name} · ${dayLabel} · ${studio.fullName}`,
    description,
    openGraph: {
      title: `${template.name} · ${dayLabel}`,
      description,
      type: "website",
    },
  };
}

export default async function ClassDetailPage({ params }: { params: Params }) {
  const { template_id, date } = await params;

  if (!UUID_RE.test(template_id) || !DATE_RE.test(date)) {
    notFound();
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const [
    templateRes,
    overrideRes,
    closedDayRes,
    instanceBookingsRes,
    userRes,
  ] = await Promise.all([
    supabase
      .from("class_templates")
      .select("*")
      .eq("id", template_id)
      .maybeSingle(),
    supabase
      .from("class_overrides")
      .select("*")
      .eq("template_id", template_id)
      .eq("instance_date", date)
      .maybeSingle(),
    supabase
      .from("closed_days")
      .select("*")
      .eq("date", date)
      .maybeSingle(),
    // Counts only — never selects user_id / roster. Privacy is intentional.
    admin
      .from("bookings")
      .select("status")
      .eq("template_id", template_id)
      .eq("instance_date", date)
      .in("status", ["booked", "waitlisted"]),
    supabase.auth.getUser(),
  ]);

  const template = templateRes.data;
  if (!template) {
    notFound();
  }

  // The URL date must actually correspond to a real instance of this template.
  if (
    template.day_of_week !== dayOfWeek(date) ||
    template.active_from > date ||
    (template.active_until !== null && template.active_until < date)
  ) {
    notFound();
  }

  // For non-public templates, only logged-in users can see the page.
  const user = userRes.data.user;
  if (!template.is_public && !user) {
    notFound();
  }

  const override = overrideRes.data;
  const closedDay = closedDayRes.data;
  const instanceBookings = instanceBookingsRes.data ?? [];
  const bookedCount = instanceBookings.filter(
    (b) => b.status === "booked",
  ).length;

  // The effective values: override beats template.
  const startTime = override?.override_start_time ?? template.start_time;
  const capacity = override?.override_capacity ?? template.capacity;
  const durationMinutes =
    override?.override_duration_minutes ?? template.duration_minutes;

  const cancelledByOverride = !!override?.cancelled;
  const cancelledByClosedDay = !!closedDay;
  const isCancelled = cancelledByOverride || cancelledByClosedDay;
  const isPast = isClassInPast(date, startTime);
  const isFull = bookedCount >= capacity;

  // User's existing (non-cancelled) booking for this exact instance, plus
  // their approval status — an unapproved student can't book yet.
  let userBooking: {
    id: string;
    status: "booked" | "waitlisted";
    waitlist_position: number | null;
  } | null = null;
  let isApproved = false;
  let isPaused = false;
  let isIncomplete = false;
  let isUnpaid = false;
  if (user) {
    const [bookingRes, profileRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, status, waitlist_position")
        .eq("template_id", template_id)
        .eq("instance_date", date)
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .maybeSingle(),
      supabase
        .from("profiles")
        .select(
          "approved, is_admin, is_blocked, full_name, phone, birthday, has_monthly_fee, joined_at",
        )
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (bookingRes.data) {
      userBooking = {
        id: bookingRes.data.id,
        status: bookingRes.data.status as "booked" | "waitlisted",
        waitlist_position: bookingRes.data.waitlist_position,
      };
    }
    isApproved =
      !!profileRes.data?.approved || !!profileRes.data?.is_admin;
    isPaused =
      !!profileRes.data?.is_blocked && !profileRes.data?.is_admin;
    isIncomplete =
      !profileRes.data?.is_admin &&
      (!profileRes.data?.full_name ||
        !profileRes.data?.phone ||
        !profileRes.data?.birthday);
    isUnpaid =
      isApproved && !isPaused && !isIncomplete && profileRes.data
        ? await isUnpaidAndBlocked(user.id, profileRes.data)
        : false;
  }

  const backHref = `/aulas?week=${mondayOf(date)}`;

  // Build the absolute URL once on the server so the share text has the right
  // host (matches custom domain after handover; works on Vercel previews too).
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const absoluteUrl = `${protocol}://${host}/aulas/${template_id}/${date}`;

  const showShareButton =
    !isCancelled && !isPast && template.is_public;

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-14">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Voltar ao horário
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {formatDayHeader(date)}
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-[0.04em] sm:text-5xl">
            {template.name.toUpperCase()}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            com {studio.coach} · {studio.city}
          </p>

          {!template.is_public && (
            <p className="mt-3 inline-flex items-center rounded-sm border border-foreground/30 bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-foreground">
              Só membros
            </p>
          )}
        </div>

        {showShareButton && (
          <WhatsAppShareButton
            className_name={template.name}
            dayLabel={formatDayHeader(date)}
            timeLabel={formatTime(startTime)}
            url={absoluteUrl}
          />
        )}
      </div>

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="mt-8 rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-destructive">
            {cancelledByClosedDay ? "Estúdio fechado" : "Aula cancelada"}
          </p>
          {(cancelledByClosedDay
            ? closedDay?.reason
            : override?.reason) && (
            <p className="mt-1 text-sm text-foreground/80">
              {cancelledByClosedDay ? closedDay?.reason : override?.reason}
            </p>
          )}
        </div>
      )}

      {/* Class info grid */}
      <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border/60 bg-border/60">
        <Stat label="Hora" value={formatTime(startTime)} />
        <Stat label="Duração" value={`${durationMinutes} min`} />
        <Stat
          label="Lugares"
          value={
            isCancelled ? "—" : `${bookedCount}/${capacity}`
          }
          hint={
            !isCancelled && isFull ? "cheia" : undefined
          }
        />
      </div>

      {/* Description */}
      {template.description && (
        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Sobre a aula
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-foreground/80">
            {template.description}
          </p>
        </div>
      )}

      {/* Primary action card */}
      <div className="mt-10">
        <BookingAction
          template_id={template_id}
          date={date}
          isCancelled={isCancelled}
          isPast={isPast}
          isFull={isFull}
          isLoggedIn={!!user}
          isApproved={isApproved}
          isPaused={isPaused}
          isIncomplete={isIncomplete}
          isUnpaid={isUnpaid}
          userBooking={userBooking}
        />
      </div>

      {/* Cancellation rule reminder */}
      {!isCancelled && !isPast && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Cancelas até 4h antes do início, em{" "}
          <Link
            href="/perfil"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Perfil
          </Link>
          .
        </p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-background px-4 py-5 text-center">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl tabular-nums">{value}</p>
      {hint && (
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function BookingAction({
  template_id,
  date,
  isCancelled,
  isPast,
  isFull,
  isLoggedIn,
  isApproved,
  isPaused,
  isIncomplete,
  isUnpaid,
  userBooking,
}: {
  template_id: string;
  date: string;
  isCancelled: boolean;
  isPast: boolean;
  isFull: boolean;
  isLoggedIn: boolean;
  isApproved: boolean;
  isPaused: boolean;
  isIncomplete: boolean;
  isUnpaid: boolean;
  userBooking: {
    id: string;
    status: "booked" | "waitlisted";
    waitlist_position: number | null;
  } | null;
}) {
  if (isCancelled) {
    return null;
  }

  if (isPast) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 p-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Esta aula já passou
        </p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Button
        render={<Link href={`/login?next=/aulas/${template_id}/${date}`} />}
        nativeButton={false}
        className="h-12 w-full text-base"
      >
        Entrar para marcar
      </Button>
    );
  }

  // Logged in but not yet approved — explain instead of offering a button.
  if (!isApproved) {
    return (
      <div className="rounded-md border border-foreground/25 bg-muted/30 p-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Conta
        </p>
        <p className="mt-2 font-display text-2xl tracking-wide">
          A AGUARDAR APROVAÇÃO
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Vais poder marcar aulas assim que o treinador aprovar a tua conta.
        </p>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-border/60 px-4 text-xs uppercase tracking-widest hover:bg-muted"
        >
          O que falta? →
        </Link>
      </div>
    );
  }

  if (userBooking?.status === "booked") {
    return (
      <div className="rounded-md border border-foreground/30 bg-foreground/5 p-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Estado
        </p>
        <p className="mt-2 font-display text-3xl tracking-wide">MARCADO</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Vê em Perfil para cancelar.
        </p>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-border/60 px-4 text-xs uppercase tracking-widest hover:bg-muted"
        >
          Ir para Perfil →
        </Link>
      </div>
    );
  }

  if (userBooking?.status === "waitlisted") {
    return (
      <div className="rounded-md border border-border/60 bg-muted/30 p-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Lista de espera
        </p>
        <p className="mt-2 font-display text-3xl tracking-wide">
          {userBooking.waitlist_position
            ? `#${userBooking.waitlist_position}`
            : "Em espera"}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Avisamos-te quando houver vaga.
        </p>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-border/60 px-4 text-xs uppercase tracking-widest hover:bg-muted"
        >
          Sair em Perfil →
        </Link>
      </div>
    );
  }

  // Incomplete profile — name or phone missing. The bookClass action would
  // bounce them; explain instead of offering the button.
  if (isIncomplete) {
    return (
      <div className="rounded-md border border-foreground/25 bg-muted/30 p-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Conta
        </p>
        <p className="mt-2 font-display text-2xl tracking-wide">
          PERFIL INCOMPLETO
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Precisamos do teu nome, telefone e data de nascimento antes de
          marcares aulas.
        </p>
        <Link
          href="/bem-vindo"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-border/60 px-4 text-xs uppercase tracking-widest hover:bg-muted"
        >
          Completar agora →
        </Link>
      </div>
    );
  }

  // Paused account — keeps any existing booking above, but can't make a new
  // one. Explain instead of offering the button.
  if (isPaused) {
    return (
      <div className="rounded-md border border-foreground/25 bg-muted/30 p-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Conta
        </p>
        <p className="mt-2 font-display text-2xl tracking-wide">
          CONTA EM PAUSA
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Não podes marcar novas aulas enquanto a conta estiver em pausa.
        </p>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-border/60 px-4 text-xs uppercase tracking-widest hover:bg-muted"
        >
          Saber mais →
        </Link>
      </div>
    );
  }

  // Unpaid past the monthly cutoff — locked until they settle up.
  if (isUnpaid) {
    return (
      <div className="rounded-md border border-foreground/25 bg-muted/30 p-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Mensalidade
        </p>
        <p className="mt-2 font-display text-2xl tracking-wide">
          MENSALIDADE EM FALTA
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Acerta a mensalidade de {currentMonthLabel()} com o {studio.coach}{" "}
          para voltares a marcar.
        </p>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-border/60 px-4 text-xs uppercase tracking-widest hover:bg-muted"
        >
          Saber mais →
        </Link>
      </div>
    );
  }

  return (
    <form action={bookClass}>
      <input type="hidden" name="template_id" value={template_id} />
      <input type="hidden" name="instance_date" value={date} />
      <input
        type="hidden"
        name="return_to"
        value={`/aulas/${template_id}/${date}`}
      />
      <SubmitButton
        className="h-12 w-full text-base"
        pendingText={isFull ? "A entrar…" : "A marcar…"}
      >
        {isFull ? "Entrar na lista de espera" : "Marcar aula"}
      </SubmitButton>
    </form>
  );
}
