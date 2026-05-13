import { studio } from "@/lib/studio.config";

// Root-level loading state. Shows when any route is suspending — typically
// the initial page load before hydration, and slow data fetches that don't
// have a closer loading.tsx.
//
// Branded so the wait feels like the studio app, not a generic spinner.
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <p className="font-display text-5xl tracking-[0.08em] sm:text-6xl animate-pulse">
          {studio.name.toUpperCase()}
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Boxing &amp; Training
        </p>
      </div>
      <p className="mt-12 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
        a carregar…
      </p>
    </div>
  );
}
