// The student's lifetime class count on their own profile — turns "I'll lose
// my history" into the most motivating thing on the page. A big number in a
// ring that fills toward the next milestone; only ever goes up, never resets.
// Neutral (no gold), matching the admin plan card. Purely presentational —
// reuses the total already computed by getStudentStats, so zero extra queries.

const MILESTONES = [10, 50, 100, 250, 500];

export function StreakCard({ total }: { total: number }) {
  const next = MILESTONES.find((m) => m > total) ?? null;
  const progress = next ? Math.min(1, total / next) : 1;

  const r = 74;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - progress);

  return (
    <section className="mt-12 rounded-2xl border border-border/60 p-6 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        Aulas feitas
      </p>

      <div className="relative mx-auto mt-4 size-44">
        <svg viewBox="0 0 168 168" className="size-full -rotate-90">
          <circle
            cx="84"
            cy="84"
            r={r}
            fill="none"
            style={{ stroke: "var(--border)" }}
            strokeWidth="9"
          />
          <circle
            cx="84"
            cy="84"
            r={r}
            fill="none"
            style={{ stroke: "var(--foreground)" }}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-5xl leading-none tabular-nums">
            {total}
          </span>
          <span className="mt-1.5 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {total === 1 ? "aula" : "aulas"}
          </span>
        </div>
      </div>

      {next ? (
        <p className="mt-1 text-sm">
          Faltam <span className="font-semibold">{next - total}</span> para o
          próximo marco ({next})
        </p>
      ) : (
        <p className="mt-1 text-sm">Passaste todos os marcos!</p>
      )}

      <div className="mx-auto mt-5 grid max-w-xs grid-cols-5 gap-1.5">
        {MILESTONES.map((m) => {
          const done = total >= m;
          const isNext = m === next;
          return (
            <div key={m} className="flex flex-col items-center gap-1.5">
              <div
                className={`flex size-11 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                  done
                    ? "bg-foreground text-background"
                    : isNext
                      ? "border border-dashed border-foreground"
                      : "border border-border text-muted-foreground"
                }`}
              >
                {m}
              </div>
              {isNext && (
                <span className="text-[9px] font-bold uppercase tracking-wider">
                  Próximo
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
