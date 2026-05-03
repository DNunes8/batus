import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

const MODALITIES = [
  {
    name: "Boxe",
    description: "De iniciados a avançados. Técnica, ritmo, sparring.",
  },
  {
    name: "Kickboxing",
    description: "Combinações, percussão e cardio em grupo.",
  },
  {
    name: "1:1",
    description: "Sessões individuais com foco específico — combate, recuperação ou forma.",
  },
  {
    name: "Combate",
    description: "Preparação técnica e física para atletas de competição.",
  },
] as const;

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("class_templates")
    .select("name, day_of_week, start_time, duration_minutes")
    .order("day_of_week")
    .order("start_time")
    .limit(8);

  const heroImage = studio.brand.hero_image_url;
  const coachImage = studio.brand.coach_image_url;

  return (
    <>
      {/* HERO — two columns: editorial type left, photo right */}
      <section className="border-b border-border/60">
        <div className="mx-auto grid max-w-7xl items-stretch lg:grid-cols-[1.1fr_1fr]">
          <div className="flex animate-in flex-col justify-center px-6 py-16 fade-in slide-in-from-bottom-2 duration-700 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {studio.city} · {studio.country}
            </p>
            <h1 className="mt-6 font-display text-7xl leading-[0.85] tracking-[0.04em] sm:text-8xl xl:text-[10rem]">
              {studio.name.toUpperCase()}
            </h1>
            <p className="mt-3 text-2xl uppercase tracking-[0.2em] text-muted-foreground sm:text-3xl">
              Boxing &amp; Training
            </p>
            <p className="mt-10 max-w-md text-lg text-foreground/80">
              Estúdio de boxe e kickboxing em {studio.city} com o treinador{" "}
              <span className="text-foreground">{studio.coach}</span>. Aulas de
              grupo e sessões individuais.
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

          <div className="relative aspect-[4/5] bg-foreground sm:aspect-[3/2] lg:aspect-auto lg:min-h-[600px]">
            {heroImage ? (
              <Image
                src={heroImage}
                alt={`${studio.fullName} — ${studio.coach}`}
                fill
                priority
                quality={95}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-foreground">
                <span className="font-display text-8xl tracking-widest text-background/20">
                  B
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CHARACTER STRIP — dark band gives the page weight + rhythm */}
      <section className="border-b border-border/60 bg-foreground text-background">
        <div className="mx-auto grid max-w-7xl divide-y divide-background/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Stat label="Modalidades" value="Boxe · Kickboxing" />
          <Stat label="Aulas" value="Grupo · Individuais" />
          <Stat label="Estúdio" value={`${studio.city}, ${studio.country}`} />
        </div>
      </section>

      {/* COACH — photo left, text right */}
      <section className="border-b border-border/60">
        <div className="mx-auto grid max-w-7xl items-center gap-0 lg:grid-cols-2">
          <div className="relative aspect-[4/5] bg-foreground sm:aspect-[3/2] lg:aspect-auto lg:min-h-[640px]">
            {coachImage ? (
              <Image
                src={coachImage}
                alt={studio.coach}
                fill
                quality={95}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-display text-7xl tracking-[0.08em] text-background/30">
                  {studio.coach.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="px-6 py-16 sm:px-12 sm:py-20 lg:px-16">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Treinador
            </p>
            <h2 className="mt-4 font-display text-5xl leading-tight tracking-[0.04em] sm:text-6xl">
              {studio.coach.toUpperCase()}
            </h2>
            <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground/80">
              <p>
                Pugilista profissional e treinador em {studio.city},{" "}
                {studio.coach.split(" ")[0]} fundou o {studio.fullName} com a
                missão de transmitir boxe e kickboxing de forma técnica,
                exigente e acessível a todos os níveis.
              </p>
              <p>
                Aulas de grupo para iniciados e avançados, e sessões individuais
                para quem quer atenção personalizada — recuperação, preparação
                de combate, ou simplesmente forma física.
              </p>
            </div>
            <Link
              href="/sobre"
              className="mt-10 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest hover:underline"
            >
              Saber mais
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* MODALITIES GRID — typographic cards */}
      <section className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-12 sm:py-24 lg:px-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Modalidades
              </p>
              <h2 className="mt-4 font-display text-5xl tracking-[0.04em] sm:text-6xl">
                O QUE TREINAMOS
              </h2>
            </div>
          </div>

          <div className="mt-12 grid gap-px bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
            {MODALITIES.map((m, i) => (
              <div key={m.name} className="bg-background p-6 sm:p-8">
                <p className="text-xs tabular-nums text-muted-foreground">
                  0{i + 1}
                </p>
                <h3 className="mt-3 font-display text-3xl tracking-[0.04em]">
                  {m.name.toUpperCase()}
                </h3>
                <p className="mt-3 text-sm text-foreground/70">
                  {m.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCHEDULE PREVIEW — light side with subtle logo watermark */}
      <section className="relative overflow-hidden border-b border-border/60">
        {studio.brand.logo_url && (
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 top-1/2 hidden -translate-y-1/2 opacity-[0.04] lg:block"
          >
            <Image
              src={studio.brand.logo_url}
              alt=""
              width={520}
              height={520}
              quality={95}
            />
          </div>
        )}

        <div className="relative mx-auto max-w-7xl px-6 py-20 sm:px-12 sm:py-24 lg:px-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Aulas
              </p>
              <h2 className="mt-4 font-display text-5xl tracking-[0.04em] sm:text-6xl">
                HORÁRIO SEMANAL
              </h2>
              <p className="mt-3 max-w-md text-sm text-muted-foreground">
                Aulas de boxe e kickboxing ao longo da semana. Marca um clique
                e estás dentro.
              </p>
            </div>
            <Button
              render={<Link href="/aulas" />}
              nativeButton={false}
              variant="outline"
            >
              Ver completo
            </Button>
          </div>

          {!templates || templates.length === 0 ? (
            <p className="mt-12 text-sm text-muted-foreground">
              Horário em construção. Contacta-nos para mais informações.
            </p>
          ) : (
            <ul className="mt-12 grid gap-px bg-border/60 sm:grid-cols-2">
              {templates.map((t, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-6 bg-background px-5 py-5 sm:px-6 sm:py-6"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      {DAY_LABEL[t.day_of_week]}
                    </p>
                    <p className="mt-1 text-base font-medium">{t.name}</p>
                  </div>
                  <span className="font-display text-3xl tracking-wider tabular-nums">
                    {formatTime(t.start_time)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* CTA — full-bleed dark close with hero photo + prominent logo */}
      <section className="relative overflow-hidden bg-foreground text-background">
        {heroImage && (
          <div aria-hidden className="absolute inset-0">
            <Image
              src={heroImage}
              alt=""
              fill
              quality={90}
              sizes="100vw"
              className="object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-foreground/70" />
          </div>
        )}

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:px-12 sm:py-32 lg:px-16">
          {studio.brand.logo_url && (
            <span className="relative mb-10 block size-32 overflow-hidden rounded-full">
              <Image
                src={studio.brand.logo_url}
                alt=""
                fill
                quality={95}
                sizes="128px"
                className="scale-[1.18] object-cover invert"
              />
            </span>
          )}

          <div className="grid items-end gap-12 lg:grid-cols-2">
            <h2 className="font-display text-6xl leading-[0.9] tracking-[0.04em] sm:text-7xl xl:text-8xl">
              PRONTO PARA<br />
              COMEÇAR?
            </h2>
            <div className="space-y-6">
              <p className="text-lg text-background/80">
                Marca a tua primeira aula ou contacta-nos para combinar uma
                avaliação. Treinos de grupo e individuais.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  render={<Link href="/login" />}
                  nativeButton={false}
                  size="lg"
                  className="bg-background text-foreground hover:bg-background/90"
                >
                  Marcar aula
                </Button>
                <Button
                  render={<Link href="/contacto" />}
                  nativeButton={false}
                  size="lg"
                  className="border border-background/30 bg-transparent text-background hover:bg-background/10"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-10 sm:px-8 sm:py-12">
      <p className="text-[10px] uppercase tracking-[0.3em] text-background/60">
        {label}
      </p>
      <p className="mt-3 font-display text-2xl tracking-[0.04em] sm:text-3xl">
        {value}
      </p>
    </div>
  );
}
