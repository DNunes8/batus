"use client";

import { useTransition } from "react";
import { setCancellationCutoff } from "./actions";

// Tap-to-choose cancellation rule. A client component only so the confirm can
// NAME the option being chosen ("Mudar para 2 horas antes?") — a generic
// "tens a certeza?" on a settings change is noise a non-technical coach learns
// to tap through. The native confirm is the same one used everywhere else in
// the admin, so it looks like the rest of the app.
export function CutoffChips({
  options,
  current,
}: {
  options: { hours: number; label: string }[];
  current: number;
}) {
  const [pending, startTransition] = useTransition();

  function choose(hours: number, label: string) {
    if (pending || hours === current) return;
    if (!window.confirm(`Mudar para "${label}"?\n\nOs alunos passam a poder desmarcar até ${label}.`)) {
      return;
    }
    const fd = new FormData();
    fd.set("hours", String(hours));
    startTransition(() => {
      // Redirects on success, which surfaces the confirmation toast.
      void setCancellationCutoff(fd);
    });
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((o) => {
        const selected = o.hours === current;
        return (
          <button
            key={o.hours}
            type="button"
            onClick={() => choose(o.hours, o.label)}
            disabled={pending}
            aria-pressed={selected}
            className={`flex h-12 items-center justify-center rounded-md border px-2 text-center text-sm font-medium transition-colors disabled:opacity-60 ${
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border/60 hover:border-foreground"
            }`}
          >
            {o.label.charAt(0).toUpperCase() + o.label.slice(1)}
          </button>
        );
      })}
    </div>
  );
}
