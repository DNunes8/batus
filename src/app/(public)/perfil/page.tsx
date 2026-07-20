import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { Reconnecting } from "@/components/reconnecting";
import { studio } from "@/lib/studio.config";
import { currentMonthLabel, isUnpaidAndBlocked } from "@/lib/payment";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { formatTime } from "@/lib/schedule";
import { getStudentStats } from "@/lib/stats";
import { cancelBooking } from "@/app/(public)/aulas/actions";
import {
  BIRTHDAY_DAYS,
  MONTHS_PT,
  birthYearOptions,
  splitBirthday,
} from "@/lib/birthday";
import { updateOwnProfile } from "./actions";
import { ChangePasswordForm } from "./change-password-form";
import { AutoScrollTo } from "./auto-scroll";
import { StreakCard } from "./streak-card";

export const dynamic = "force-dynamic";

const SELECT_CLASSES =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const PT_DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PT_MONTHS_SHORT = [
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

function formatBookingDate(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${PT_DAYS_SHORT[date.getUTCDay()]} ${date.getUTCDate()} ${
    PT_MONTHS_SHORT[date.getUTCMonth()]
  }`;
}

// "1997-02-11" -> "11 Fevereiro 1997"
function formatBirthdayLong(iso: string | null | undefined): string {
  const { day, month, year } = splitBirthday(iso);
  if (!day || !month || !year) return "";
  const m = MONTHS_PT.find((mm) => String(mm.value) === month);
  return `${day} ${m ? m.label : month} ${year}`;
}

export default async function PerfilPage({
  searchParams,
}: {
  searchParams?: Promise<{ reset?: string; edit?: string; pw?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const isReset = params.reset === "1";

  const supabase = await createClient();
  const { user, transient } = await getAuthUser(supabase);

  if (!user) {
    if (transient) return <Reconnecting />;
    redirect("/login?next=/perfil");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const stats = await getStudentStats(user.id);

  // Admins are always treated as approved; everyone else needs the flag.
  const isApproved = !!profile?.approved || !!profile?.is_admin;
  // A paused account stays approved but is blocked from booking new classes.
  const isPaused = !!profile?.is_blocked && !profile?.is_admin;
  // Missing name, phone, or birthday — must be filled before anything else
  // (the coach can't have nameless rows in the Alunos list, and the dashboard
  // birthday banner needs every student dated). Admins are exempt.
  const isIncomplete =
    !profile?.is_admin &&
    (!profile?.full_name || !profile?.phone || !profile?.birthday);
  // Unpaid past the monthly cutoff — shown as its own panel; stats/bookings
  // stay visible so existing marcações remain cancellable.
  const isUnpaid =
    isApproved && !isPaused && !isIncomplete && profile
      ? await isUnpaidAndBlocked(user.id, profile)
      : false;

  // The "Os teus dados" section shows a read-only summary by default and only
  // becomes a form on ?edit=1 — or automatically when the profile is still
  // incomplete (nothing to display yet). Password works the same: collapsed
  // until ?pw=1, and auto-open during the reset flow.
  const isEditing = params.edit === "1" || isIncomplete;
  const showPassword = params.pw === "1" || isReset;

  const since = profile
    ? new Date(profile.joined_at).toLocaleDateString("pt-PT", {
        year: "numeric",
        month: "long",
      })
    : "";

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {isReset && <AutoScrollTo targetId="palavra-passe" />}

      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Perfil
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-[0.04em] sm:text-5xl">
        {(profile?.full_name || profile?.email || "").toUpperCase()}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {profile?.email} · Aluno desde {since}
      </p>

      {isReset && (
        <div className="mt-8 rounded-md border border-foreground/30 bg-foreground/5 p-4 sm:p-5">
          <p className="font-medium">Define a tua nova palavra-passe</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Estás dentro graças ao link mágico. Para entrares no futuro sem
            esperar por um email, define agora uma palavra-passe em baixo.
          </p>
          <a
            href="#palavra-passe"
            className="mt-3 inline-block text-xs uppercase tracking-[0.2em] underline-offset-4 hover:underline"
          >
            Ir para Palavra-passe ↓
          </a>
        </div>
      )}

      {/* Incomplete profile — must come before the pending/paused panels so
          the student fills the form first; the coach can't have nameless
          rows in the Alunos list. */}
      {isIncomplete && (
        <div className="mt-8 rounded-md border border-foreground/25 bg-muted/40 p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Estado da conta
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-[0.04em] sm:text-3xl">
            FALTA COMPLETAR O PERFIL
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground/80">
            Precisamos do teu nome, telefone e data de nascimento, para o
            treinador saber quem és, conseguir contactar-te e desejar os
            parabéns no dia. Preenche em baixo na secção{" "}
            <strong>Os teus dados</strong>.
          </p>
          <a
            href="#os-teus-dados"
            className="mt-4 inline-flex h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
          >
            Ir para Os teus dados ↓
          </a>
        </div>
      )}

      {/* Pending account — leads the page with a clear "what's next" panel
          instead of stats/bookings the student can't have yet. */}
      {!isApproved && !isIncomplete && (
        <div className="mt-8 rounded-md border border-foreground/25 bg-muted/40 p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Estado da conta
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-[0.04em] sm:text-3xl">
            A AGUARDAR APROVAÇÃO
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground/80">
            O {studio.name} aprova cada novo aluno antes da primeira aula. Já
            temos o teu registo. Falta só falares com o {studio.coach} para
            combinarem a tua entrada.
          </p>
          <div className="mt-4 rounded-md border border-border/60 bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Próximo passo
            </p>
            <p className="mt-1 text-sm text-foreground/80">
              Contacta o treinador. Assim que aprovar a tua conta, podes marcar
              aulas no horário, sem precisares de voltar a entrar.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {studio.social.instagram && (
              <a
                href={`https://instagram.com/${studio.social.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-md border border-border/60 px-4 text-sm font-medium hover:bg-muted"
              >
                Instagram @{studio.social.instagram}
              </a>
            )}
            <Link
              href="/contacto"
              className="inline-flex h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
            >
              Contactar
            </Link>
          </div>
        </div>
      )}

      {/* Paused account — still approved, so stats/bookings stay visible below
          (existing bookings remain cancellable), but no new bookings. */}
      {isApproved && isPaused && !isIncomplete && (
        <div className="mt-8 rounded-md border border-foreground/25 bg-muted/40 p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Estado da conta
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-[0.04em] sm:text-3xl">
            CONTA EM PAUSA
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground/80">
            A tua conta está em pausa, por isso não podes marcar novas aulas. As
            marcações que já tens mantêm-se. Fala com o {studio.coach} para
            reativares a conta.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {studio.social.instagram && (
              <a
                href={`https://instagram.com/${studio.social.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-md border border-border/60 px-4 text-sm font-medium hover:bg-muted"
              >
                Instagram @{studio.social.instagram}
              </a>
            )}
            <Link
              href="/contacto"
              className="inline-flex h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
            >
              Contactar
            </Link>
          </div>
        </div>
      )}

      {/* Unpaid past the monthly cutoff — friendly reminder; existing bookings
          below stay cancellable, but no new ones until they settle up. */}
      {isApproved && isUnpaid && !isPaused && !isIncomplete && (
        <div className="mt-8 rounded-md border border-foreground/25 bg-muted/40 p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Estado da conta
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-[0.04em] sm:text-3xl">
            MENSALIDADE EM FALTA
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground/80">
            Ainda não registámos a tua mensalidade de {currentMonthLabel()}. As
            marcações ficam em pausa até acertares. Fala com o {studio.coach} e
            ficas logo a marcar outra vez.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {studio.social.instagram && (
              <a
                href={`https://instagram.com/${studio.social.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-md border border-border/60 px-4 text-sm font-medium hover:bg-muted"
              >
                Instagram @{studio.social.instagram}
              </a>
            )}
            <Link
              href="/contacto"
              className="inline-flex h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
            >
              Contactar
            </Link>
          </div>
        </div>
      )}

      {/* Stats + bookings only make sense once the student can actually book. */}
      {isApproved && !isIncomplete && (
        <>
          <StreakCard total={stats.total_attended} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Aulas este mês"
              value={stats.attended_this_month}
            />
            <StatCard label="Próximas" value={stats.upcoming.length} />
          </div>

          <section className="mt-16">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Próximas aulas
            </h2>
            {stats.upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Sem aulas marcadas.{" "}
                <Link href="/aulas" className="hover:underline">
                  Ver horário →
                </Link>
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border/60 rounded-md border border-border/60">
                {stats.upcoming.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-display text-lg tracking-wider tabular-nums">
                        {formatTime(b.start_time)}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {b.template_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBookingDate(b.instance_date)} ·{" "}
                          {b.duration_minutes} min
                        </p>
                      </div>
                    </div>
                    <form
                      action={cancelBooking}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="booking_id" value={b.id} />
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">
                        {b.status === "waitlisted" ? "Em espera" : "Marcado"}
                      </span>
                      <SubmitButton
                        variant="outline"
                        className="h-10 px-4"
                        pendingText="A cancelar…"
                      >
                        Cancelar
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Os teus dados — read-only summary with an Editar toggle, so an
          already-filled profile doesn't look like a form asking again. */}
      <section id="os-teus-dados" className="mt-16 scroll-mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Os teus dados
          </h2>
          {!isEditing && (
            <Link
              href="/perfil?edit=1#os-teus-dados"
              className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
            >
              Editar
            </Link>
          )}
        </div>

        {isEditing ? (
          <form
            action={updateOwnProfile}
            className="mt-4 space-y-4 rounded-md border border-border/60 p-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  required
                  defaultValue={profile?.full_name ?? ""}
                  placeholder="O teu nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  defaultValue={profile?.phone ?? ""}
                  placeholder="9XX XXX XXX"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento</Label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  name="birthday_day"
                  required
                  defaultValue={splitBirthday(profile?.birthday).day}
                  aria-label="Dia"
                  autoComplete="bday-day"
                  className={SELECT_CLASSES}
                >
                  <option value="" disabled>
                    Dia
                  </option>
                  {BIRTHDAY_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  name="birthday_month"
                  required
                  defaultValue={splitBirthday(profile?.birthday).month}
                  aria-label="Mês"
                  autoComplete="bday-month"
                  className={SELECT_CLASSES}
                >
                  <option value="" disabled>
                    Mês
                  </option>
                  {MONTHS_PT.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  name="birthday_year"
                  required
                  defaultValue={splitBirthday(profile?.birthday).year}
                  aria-label="Ano"
                  autoComplete="bday-year"
                  className={SELECT_CLASSES}
                >
                  <option value="" disabled>
                    Ano
                  </option>
                  {birthYearOptions().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goals">Objetivos (opcional)</Label>
              <Textarea
                id="goals"
                name="goals"
                rows={2}
                defaultValue={profile?.goals ?? ""}
                placeholder="ex: melhorar técnica, perder peso"
              />
              <p className="text-xs text-muted-foreground">
                Partilhar isto com o treinador ajuda a personalizar o teu
                treino.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton className="h-11 text-base" pendingText="A guardar…">
                Guardar
              </SubmitButton>
              {!isIncomplete && (
                <Link
                  href="/perfil#os-teus-dados"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </Link>
              )}
            </div>
          </form>
        ) : (
          <dl className="mt-4 divide-y divide-border/60 rounded-md border border-border/60">
            <DetailRow label="Nome" value={profile?.full_name} />
            <DetailRow label="Telefone" value={profile?.phone} />
            <DetailRow
              label="Data de nascimento"
              value={formatBirthdayLong(profile?.birthday)}
            />
            {profile?.goals && (
              <DetailRow label="Objetivos" value={profile.goals} />
            )}
          </dl>
        )}
      </section>

      {/* Palavra-passe — collapsed behind a button; opens on ?pw=1 or during
          the reset flow. Avoids looking like we're asking them to set one. */}
      <section id="palavra-passe" className="mt-16 scroll-mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Palavra-passe
          </h2>
          {!showPassword && (
            <Link
              href="/perfil?pw=1#palavra-passe"
              className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
            >
              Alterar
            </Link>
          )}
        </div>

        {showPassword ? (
          <div
            className={`mt-4 rounded-md border p-4 ${
              isReset
                ? "border-foreground/30 bg-foreground/[0.03]"
                : "border-border/60"
            }`}
          >
            <ChangePasswordForm />
            {!isReset && (
              <Link
                href="/perfil#palavra-passe"
                className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-border/60 px-4 py-3">
            <span className="text-sm tracking-[0.3em] text-muted-foreground">
              ••••••••
            </span>
            <Link
              href="/perfil?pw=1#palavra-passe"
              className="text-sm font-medium hover:underline"
            >
              Alterar
            </Link>
          </div>
        )}
      </section>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value || ""}</dd>
    </div>
  );
}
