import Image from "next/image";
import Link from "next/link";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: `Sobre — ${studio.fullName}`,
  description: `Conhece o ${studio.fullName}: estúdio de boxe, kickboxing e muay thai do treinador ${studio.coach}, em ${studio.city}.`,
};

const MODALIDADES = [
  {
    name: "Boxe",
    description:
      "A base de tudo. Guarda, distância e trabalho de mãos — do primeiro jab ao sparring.",
  },
  {
    name: "Kickboxing",
    description:
      "Mãos e pernas. Combinações, percussão e muito condicionamento em grupo.",
  },
  {
    name: "Muay Thai",
    description:
      "A arte das oito armas — punhos, cotovelos, joelhos e canelas. Técnica e clinch.",
  },
  {
    name: "Sessões 1:1",
    description:
      "Treino individual focado no que precisas — técnica, recuperação ou preparação de combate.",
  },
] as const;

const PARA_QUEM = [
  {
    title: "Iniciados",
    description:
      "Nunca calçaste luvas? Começas do zero, ao teu ritmo e sem julgamentos.",
  },
  {
    title: "Avançados",
    description:
      "Já treinas? Técnica fina, sparring e o ritmo de quem quer evoluir.",
  },
  {
    title: "Atletas",
    description: "Preparação física e técnica específica para quem compete.",
  },
] as const;

export default function SobrePage() {
  const heroImage = studio.brand.hero_image_url;
  const coachImage = studio.brand.coach_image_url;
  const gallery = studio.brand.about_gallery;
  const videoUrl = studio.brand.about_video_url;
  const coachFirstName = studio.coach.split(" ")[0];

  return (
    <>
      {/* HERO — full-bleed photo with a dark cinematic scrim. The scrim is
          darkest at the bottom so the white title stays readable over any
          photo — and the section reads fine even with no photo at all. */}
      <section className="relative isolate flex min-h-[60vh] items-end overflow-hidden border-b border-border/60 bg-foreground sm:min-h-[70vh]">
        {heroImage && (
          <Image
            src={heroImage}
            alt={`${studio.fullName} — ${studio.coach}`}
            fill
            priority
            quality={95}
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/70 to-foreground/20"
        />
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-12 sm:px-12 sm:pb-16 lg:px-16">
          <p className="text-xs uppercase tracking-[0.3em] text-background/60">
            Sobre
          </p>
          <h1 className="mt-4 font-display text-6xl leading-[0.85] tracking-[0.04em] text-background sm:text-8xl">
            {studio.name.toUpperCase()}
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.2em] text-background/70">
            Boxing &amp; Training · {studio.city}, {studio.country}
          </p>
        </div>
      </section>

      {/* O ESTÚDIO — story / philosophy */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-12 sm:py-28 lg:px-16">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            O estúdio
          </p>
          <h2 className="mt-6 max-w-3xl font-display text-4xl leading-[1.05] tracking-[0.03em] sm:text-5xl">
            BOXE E KICKBOXING,
            <br />
            LEVADOS A SÉRIO.
          </h2>
          <div className="mt-10 grid max-w-4xl gap-6 text-base leading-relaxed text-foreground/80 sm:mt-12 sm:grid-cols-2 sm:gap-10 sm:text-lg">
            <p>
              O {studio.fullName} é o estúdio de boxe, kickboxing e muay thai
              do treinador {studio.coach}, em {studio.city}. A ideia é simples:
              ensinar desportos de combate com método e rigor — turmas
              pequenas, atenção a cada aluno e nenhum atalho.
            </p>
            <p>
              Aqui treina-se a técnica antes da força, e o respeito antes da
              técnica. Quer queiras dar os primeiros passos, voltar à forma ou
              preparar um combate, encontras um plano à tua medida — e um
              treinador que te acompanha de perto.
            </p>
          </div>
        </div>
      </section>

      {/* O TREINADOR — photo + bio */}
      <section className="border-b border-border/60">
        <div className="mx-auto grid max-w-7xl items-center lg:grid-cols-2">
          <div className="relative min-h-[360px] bg-foreground sm:min-h-[440px] lg:min-h-[600px]">
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
              <div className="flex h-full w-full items-center justify-center p-8">
                <span className="text-center font-display text-5xl leading-none tracking-[0.06em] text-background/30 sm:text-6xl">
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
                {coachFirstName} é pugilista profissional e treinador. Fundou o{" "}
                {studio.fullName} para transmitir aquilo que o desporto lhe
                deu: técnica, disciplina e respeito.
              </p>
              <p>
                Dá aulas de grupo para iniciados e avançados, sessões
                individuais para quem precisa de atenção personalizada, e
                prepara atletas para competição. A abordagem é sempre a
                mesma — exigente, próxima e honesta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MODALIDADES + PARA QUEM */}
      <section className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-12 sm:py-24 lg:px-16">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Modalidades
          </p>
          <h2 className="mt-4 font-display text-5xl tracking-[0.04em] sm:text-6xl">
            O QUE SE TREINA
          </h2>

          <div className="mt-12 grid gap-px bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
            {MODALIDADES.map((m, i) => (
              <div key={m.name} className="bg-background p-6 sm:p-8">
                <p className="text-xs tabular-nums text-muted-foreground">
                  0{i + 1}
                </p>
                <h3 className="mt-3 font-display text-3xl tracking-[0.04em]">
                  {m.name.toUpperCase()}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  {m.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-16 border-t border-border/60 pt-12">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Para quem
            </h3>
            <div className="mt-6 grid gap-8 sm:grid-cols-3">
              {PARA_QUEM.map((p) => (
                <div key={p.title}>
                  <p className="font-display text-2xl tracking-[0.04em]">
                    {p.title.toUpperCase()}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              Aulas a partir dos 14 anos.
            </p>
          </div>
        </div>
      </section>

      {/* O ESPAÇO — studio gallery. Renders only when about_gallery has
          entries; add photo paths in studio.config.ts to light it up. */}
      {gallery.length > 0 && (
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-7xl px-6 py-20 sm:px-12 sm:py-24 lg:px-16">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              O espaço
            </p>
            <h2 className="mt-4 font-display text-5xl tracking-[0.04em] sm:text-6xl">
              O ESTÚDIO
            </h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Ringue, sacos e espaço para treinar a sério. Dá uma vista de
              olhos.
            </p>
            <div className="mt-12 grid gap-px bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((src, i) => (
                <div key={src} className="relative aspect-[4/3] bg-foreground">
                  <Image
                    src={src}
                    alt={`${studio.fullName} — o espaço ${i + 1}`}
                    fill
                    quality={90}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VÍDEO — renders only when about_video_url is set in studio.config.ts */}
      {videoUrl && (
        <section className="border-b border-border/60 bg-muted/30">
          <div className="mx-auto max-w-7xl px-6 py-20 sm:px-12 sm:py-24 lg:px-16">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Em movimento
            </p>
            <h2 className="mt-4 font-display text-5xl tracking-[0.04em] sm:text-6xl">
              VÊ COMO É
            </h2>
            <div className="mt-12 overflow-hidden rounded-lg border border-border/60 bg-foreground">
              <video
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-foreground object-cover"
              >
                <source src={videoUrl} type="video/mp4" />
                O teu browser não suporta vídeo embebido.
              </video>
            </div>
          </div>
        </section>
      )}

      {/* CTA — dark close */}
      <section className="bg-foreground text-background">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-12 sm:py-32 lg:px-16">
          <div className="grid items-end gap-10 lg:grid-cols-2">
            <h2 className="font-display text-6xl leading-[0.9] tracking-[0.04em] sm:text-7xl">
              COMEÇA A<br />
              TREINAR.
            </h2>
            <div className="space-y-6">
              <p className="max-w-md text-lg text-background/80">
                Vê o horário e marca a tua primeira aula, ou fala connosco para
                combinar uma avaliação.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  render={<Link href="/aulas" />}
                  nativeButton={false}
                  size="lg"
                  className="bg-background text-foreground hover:bg-background/90"
                >
                  Ver horário
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
