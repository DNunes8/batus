import Link from "next/link";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-32">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {studio.city} · {studio.country}
        </p>
        <h1 className="mt-6 font-display text-6xl tracking-[0.04em] leading-[0.95] sm:text-8xl">
          {studio.name.toUpperCase()}
          <span className="block text-2xl tracking-[0.2em] text-muted-foreground sm:text-3xl">
            Boxing &amp; Training
          </span>
        </h1>
        <p className="mt-8 max-w-xl text-lg text-foreground/80">
          {studio.tagline}. Treinos de grupo e individuais com o treinador{" "}
          {studio.coach}.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button
            render={<Link href="/aulas" />}
            nativeButton={false}
            size="lg"
          >
            Ver aulas
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

        <p className="mt-24 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Em construção
        </p>
      </div>
    </section>
  );
}
