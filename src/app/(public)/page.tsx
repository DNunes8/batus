import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { studio } from "@/lib/studio.config";
import { formatTime } from "@/lib/schedule";

const DAY_LABEL: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("class_templates")
    .select("name, day_of_week, start_time, duration_minutes")
    .order("day_of_week")
    .order("start_time")
    .limit(8);

  return (
    <>
      {/* Hero */}
      <section className="relative border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-40">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {studio.city} · {studio.country}
          </p>
          <h1 className="mt-6 font-display text-7xl leading-[0.9] tracking-[0.04em] sm:text-9xl">
            {studio.name.toUpperCase()}
            <span className="mt-2 block text-3xl tracking-[0.2em] text-muted-foreground sm:text-4xl">
              Boxing &amp; Training
            </span>
          </h1>
          <p className="mt-10 max-w-xl text-lg text-foreground/80">
            Treinos de boxe e kickboxing em {studio.city} com o treinador{" "}
            {studio.coach}. Aulas de grupo e sessões individuais.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button
              render={<Link href="/aulas" />}
              nativeButton={false}
              size="lg"
            >
              Ver horário
            </Button>
            <Button
              render={<Link href="/contacto" />}
              nativeButton={false}
              size="lg"
              variant="outline"
            >
              Contactar
            </Button>
          </div>
        </div>
      </section>

      {/* Coach */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-12 md:grid-cols-[1fr_2fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Treinador
              </p>
              <h2 className="mt-4 font-display text-4xl tracking-[0.04em] sm:text-5xl">
                {studio.coach.toUpperCase()}
              </h2>
            </div>
            <div className="space-y-4 text-base text-foreground/80">
              <p>
                Pugilista profissional e treinador em {studio.city}, {studio.coach}{" "}
                fundou o {studio.fullName} com a missão de transmitir boxe e
                kickboxing de forma técnica, exigente e acessível a todos os
                níveis.
              </p>
              <p>
                Aulas de grupo para iniciados e avançados, e sessões individuais
                para quem quer atenção personalizada — recuperação, preparação
                de combate, ou simplesmente forma física.
              </p>
              <Link
                href="/sobre"
                className="inline-block text-sm font-medium uppercase tracking-widest hover:underline"
              >
                Saber mais →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule preview */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Aulas
              </p>
              <h2 className="mt-4 font-display text-4xl tracking-[0.04em] sm:text-5xl">
                HORÁRIO SEMANAL
              </h2>
            </div>
            <Button
              render={<Link href="/aulas" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Ver completo
            </Button>
          </div>

          {!templates || templates.length === 0 ? (
            <p className="mt-10 text-sm text-muted-foreground">
              Horário em construção. Contacta-nos para mais informações.
            </p>
          ) : (
            <ul className="mt-10 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {templates.map((t, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-4 border-b border-border/40 pb-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {DAY_LABEL[t.day_of_week]}
                    </p>
                  </div>
                  <span className="font-display text-lg tracking-wider tabular-nums">
                    {formatTime(t.start_time)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-32">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <h2 className="font-display text-4xl tracking-[0.04em] leading-tight sm:text-5xl">
              PRONTO PARA<br />COMEÇAR?
            </h2>
            <div className="space-y-4">
              <p className="text-lg text-foreground/80">
                Marca a tua primeira aula ou contacta-nos para combinar uma
                avaliação.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  render={<Link href="/login" />}
                  nativeButton={false}
                  size="lg"
                >
                  Marcar aula
                </Button>
                <Button
                  render={<Link href="/contacto" />}
                  nativeButton={false}
                  variant="outline"
                  size="lg"
                >
                  Contactar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
