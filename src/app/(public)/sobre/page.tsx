import Link from "next/link";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";

export default function SobrePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Sobre
      </p>
      <h1 className="mt-6 font-display text-5xl tracking-[0.04em] sm:text-6xl">
        {studio.name.toUpperCase()}
      </h1>
      <p className="mt-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">
        Boxing &amp; Training · {studio.city}, {studio.country}
      </p>

      <div className="mt-12 space-y-6 text-base leading-relaxed text-foreground/80">
        <p className="text-lg">
          {studio.fullName} é o estúdio de boxe e kickboxing do treinador{" "}
          {studio.coach}, em {studio.city}.
        </p>
        <p>
          Treinos focados em técnica, condicionamento físico e aplicação real,
          numa cultura de respeito e exigência. Aulas para todos os níveis: de
          quem nunca calçou luvas a quem quer competir.
        </p>
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          [Bio do treinador a preencher]
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
  );
}
