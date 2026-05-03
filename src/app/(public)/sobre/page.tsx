import Image from "next/image";
import Link from "next/link";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";

export default function SobrePage() {
  const coachImage = studio.brand.coach_image_url;

  return (
    <>
      {/* Hero band with photo */}
      {coachImage && (
        <section className="relative h-[40vh] min-h-[280px] overflow-hidden border-b border-border/60 bg-foreground sm:h-[50vh]">
          <Image
            src={coachImage}
            alt={studio.coach}
            fill
            priority
            quality={95}
            sizes="100vw"
            className="object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="relative mx-auto flex h-full max-w-3xl items-end px-4 pb-8 sm:px-6 sm:pb-12">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-background/70">
                Sobre
              </p>
              <h1 className="mt-3 font-display text-5xl leading-[0.9] tracking-[0.04em] text-background sm:text-7xl">
                {studio.name.toUpperCase()}
              </h1>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-background/80">
                Boxing &amp; Training · {studio.city}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        {!coachImage && (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Sobre
            </p>
            <h1 className="mt-6 font-display text-5xl tracking-[0.04em] sm:text-6xl">
              {studio.name.toUpperCase()}
            </h1>
            <p className="mt-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Boxing &amp; Training · {studio.city}, {studio.country}
            </p>
          </>
        )}

        <div className="space-y-6 text-base leading-relaxed text-foreground/80 sm:mt-4">
          <p className="text-lg">
            {studio.fullName} é o estúdio de boxe e kickboxing do treinador{" "}
            {studio.coach}, em {studio.city}.
          </p>
          <p>
            Treinos focados em técnica, condicionamento físico e aplicação
            real, numa cultura de respeito e exigência. Aulas para todos os
            níveis: de quem nunca calçou luvas a quem quer competir.
          </p>
          <p>
            O estúdio combina aulas de grupo regulares com sessões individuais
            (1:1) para quem precisa de atenção personalizada — recuperação,
            preparação de combate, ou simplesmente forma física.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Modalidades
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>Boxe</li>
              <li>Kickboxing</li>
              <li>Sessões individuais (1:1)</li>
              <li>Preparação de combate</li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Para quem
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>Iniciados — sem experiência prévia</li>
              <li>Avançados — técnica e sparring</li>
              <li>Atletas — preparação específica</li>
              <li>Todos os escalões a partir dos 14 anos</li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-3">
          <Button render={<Link href="/aulas" />} nativeButton={false}>
            Ver horário
          </Button>
          <Button
            render={<Link href="/contacto" />}
            nativeButton={false}
            variant="outline"
          >
            Contactar
          </Button>
        </div>
      </section>
    </>
  );
}
