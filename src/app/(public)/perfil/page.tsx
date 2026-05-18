import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { formatTime } from "@/lib/schedule";
import { getStudentStats } from "@/lib/stats";
import { cancelBooking } from "@/app/(public)/aulas/actions";
import { updateOwnProfile } from "./actions";
import { ChangePasswordForm } from "./change-password-form";
import { AutoScrollTo } from "./auto-scroll";

export const dynamic = "force-dynamic";

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

export default async function PerfilPage({
  searchParams,
}: {
  searchParams?: Promise<{ reset?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const isReset = params.reset === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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

      {/* Pending account — leads the page with a clear "what's next" panel
          instead of stats/bookings the student can't have yet. */}
      {!isApproved && (
        <div className="mt-8 rounded-md border border-foreground/25 bg-muted/40 p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Estado da conta
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-[0.04em] sm:text-3xl">
            A AGUARDAR APROVAÇÃO
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground/80">
            O {studio.name} aprova cada novo aluno antes da primeira aula. Já
            temos o teu registo — falta só falares com o{" "}
            {studio.coach.split(" ")[0]} para combinarem a tua entrada.
          </p>
          <div className="mt-4 rounded-md border border-border/60 bg-background p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Próximo passo
            </p>
            <p className="mt-1 text-sm text-foreground/80">
              Contacta o treinador. Assim que aprovar a tua conta, podes marcar
              aulas no horário — sem precisares de voltar a entrar.
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

      {/* Stats + bookings only make sense once the student can actually book. */}
      {isApproved && (
        <>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Aulas este mês"
              value={stats.attended_this_month}
            />
            <StatCard label="Total" value={stats.total_attended} />
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

      <section className="mt-16">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Os teus dados
        </h2>
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
                defaultValue={profile?.phone ?? ""}
                placeholder="9XX XXX XXX"
              />
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
              Partilhar isto com o treinador ajuda a personalizar o teu treino.
            </p>
          </div>
          <SubmitButton className="h-11 text-base" pendingText="A guardar…">
            Guardar
          </SubmitButton>
        </form>
      </section>

      <section id="palavra-passe" className="mt-16 scroll-mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Palavra-passe
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Define uma nova palavra-passe para as próximas entradas.
        </p>
        <div
          className={`mt-4 rounded-md border p-4 ${
            isReset ? "border-foreground/30 bg-foreground/[0.03]" : "border-border/60"
          }`}
        >
          <ChangePasswordForm />
        </div>
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
