import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/schedule";
import { getStudentStats } from "@/lib/stats";
import { updateOwnProfile } from "./actions";

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

export default async function PerfilPage() {
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

  const since = profile
    ? new Date(profile.joined_at).toLocaleDateString("pt-PT", {
        year: "numeric",
        month: "long",
      })
    : "";

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Perfil
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-[0.04em] sm:text-5xl">
        {(profile?.full_name || profile?.email || "").toUpperCase()}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {profile?.email} · Aluno desde {since}
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <StatCard label="Aulas este mês" value={stats.attended_this_month} />
        <StatCard label="Total" value={stats.total_attended} />
        <StatCard label="Próximas" value={stats.upcoming.length} />
      </div>

      <section className="mt-16">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Próximas aulas
        </h2>
        {stats.upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sem aulas marcadas. <Link href="/aulas" className="hover:underline">Ver horário →</Link>
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border/60 rounded-md border border-border/60">
            {stats.upcoming.map((b) => (
              <li
                key={b.id}
                className="flex items-baseline justify-between gap-4 px-4 py-3"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-lg tracking-wider tabular-nums">
                    {formatTime(b.start_time)}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{b.template_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBookingDate(b.instance_date)} · {b.duration_minutes}{" "}
                      min
                    </p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {b.status === "waitlisted" ? "Em espera" : "Marcado"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
          <Button type="submit" size="sm">
            Guardar
          </Button>
        </form>
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
