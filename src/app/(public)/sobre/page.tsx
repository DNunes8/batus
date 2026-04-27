import { studio } from "@/lib/studio.config";

export default function SobrePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-32">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Sobre
      </p>
      <h1 className="mt-6 font-display text-5xl tracking-[0.04em] sm:text-6xl">
        {studio.coach.toUpperCase()}
      </h1>
      <p className="mt-8 max-w-2xl text-lg text-foreground/80">
        Estúdio de boxe e kickboxing em {studio.city}, dirigido pelo treinador{" "}
        {studio.coach}.
      </p>
      <p className="mt-16 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Em construção
      </p>
    </section>
  );
}
