"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PLAN_OPTIONS, currentPlan, type Plan } from "@/lib/plans";
import { setStudentPlan, adjustStudentCredits } from "./actions";

// The plan, front-and-centre on the student page. The current plan reads at a
// glance and changing it is one tap on the same buttons as the approval dialog.
// Group tiers snap the monthly fee (setStudentPlan, custom rates preserved).
// A "Pack" student instead gets a simple class-count control below.
export function PlanCard({
  student,
}: {
  student: {
    id: string;
    service_type: string | null;
    weekly_class_limit: number | null;
    class_credits: number | null;
  };
}) {
  const active = currentPlan({
    service_type: student.service_type,
    weekly_class_limit: student.weekly_class_limit,
    class_credits: student.class_credits,
  });
  const activeOption = PLAN_OPTIONS.find((o) => o.plan === active);
  const credits = student.class_credits ?? 0;

  const [planPending, startPlan] = useTransition();
  const [creditPending, startCredit] = useTransition();
  const router = useRouter();

  function choose(plan: Plan, label: string) {
    if (plan === active || planPending) return;
    startPlan(async () => {
      try {
        const result = await setStudentPlan({ id: student.id, plan });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`Plano atualizado — ${label}.`);
        router.refresh();
      } catch {
        toast.error("Não foi possível mudar o plano. Tenta novamente.");
      }
    });
  }

  function adjust(delta: number) {
    if (creditPending) return;
    startCredit(async () => {
      try {
        const result = await adjustStudentCredits({ id: student.id, delta });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`Aulas atualizadas — ${result.credits} restantes.`);
        router.refresh();
      } catch {
        toast.error("Não foi possível ajustar. Tenta novamente.");
      }
    });
  }

  return (
    <section className="mt-6 rounded-md border border-border/60 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">
        Plano
      </p>
      <p className="mt-1 text-lg font-medium">
        {activeOption?.label}
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {activeOption?.detail}
        </span>
      </p>

      <div className="mt-3 space-y-2">
        {PLAN_OPTIONS.map((opt) => {
          const isActive = opt.plan === active;
          return (
            <button
              key={opt.plan}
              type="button"
              disabled={planPending || isActive}
              onClick={() => choose(opt.plan, opt.label)}
              aria-pressed={isActive}
              className={`flex h-12 w-full items-center justify-between rounded-md border px-4 text-left transition-colors ${
                isActive
                  ? "border-foreground bg-muted/40"
                  : "border-border/60 hover:border-foreground hover:bg-muted/40 active:bg-muted/60"
              } ${planPending && !isActive ? "opacity-50" : ""}`}
            >
              <span className="text-sm font-medium">
                {opt.label}
                {isActive && <span className="ml-2">✓</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {opt.detail}
              </span>
            </button>
          );
        })}
      </div>

      {active === "pack" ? (
        <div className="mt-4 rounded-md border border-border/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">
            Aulas do pack
          </p>
          <div className="mt-3 text-center">
            <span className="font-display text-4xl leading-none tabular-nums">
              {credits}
            </span>
            <span className="mt-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              aulas restantes
            </span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[-1, 1, 5, 10].map((d) => (
              <button
                key={d}
                type="button"
                disabled={creditPending || (d < 0 && credits <= 0)}
                onClick={() => adjust(d)}
                className="h-11 rounded-md border border-border/60 text-sm font-bold transition-colors hover:border-foreground hover:bg-muted/40 active:bg-muted/60 disabled:opacity-40"
              >
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Estes botões mudam quantas aulas o aluno tem. Vendeu um pacote de 10?
            +10. Faltou e queres devolver? +1.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          O plano define o limite de aulas por semana e a mensalidade. Um valor à
          parte (na secção abaixo) é mantido.
        </p>
      )}
    </section>
  );
}
