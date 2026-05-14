import Image from "next/image";
import { studio } from "@/lib/studio.config";

// Root-level loading state. Shows during route segment loads and initial
// hydration. Branded so the wait feels like the studio app, not a generic
// spinner.
export default function Loading() {
  const stacked = studio.brand.logo?.stacked;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="relative flex items-center justify-center">
        {/* Soft gold halo pulsing behind the mark */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 rounded-full bg-gold/15 blur-3xl animate-pulse"
        />

        {stacked ? (
          <Image
            src={stacked}
            alt={studio.fullName}
            width={420}
            height={420}
            priority
            className="relative size-40 animate-in fade-in zoom-in-90 duration-700 object-contain sm:size-52"
          />
        ) : (
          <div className="relative text-center animate-in fade-in zoom-in-90 duration-700">
            <p className="font-display text-5xl tracking-[0.08em] sm:text-6xl">
              {studio.name.toUpperCase()}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Boxing &amp; Training
            </p>
          </div>
        )}
      </div>

      <p className="mt-14 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 animate-pulse">
        a carregar…
      </p>
    </div>
  );
}
