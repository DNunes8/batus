"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PLAN_OPTIONS, currentPlan, type Plan } from "@/lib/plans";
import { setStudentPlan } from "./actions";

// The plan, front-and-centre on the student page. The current plan reads at a
// glance and changing it is one tap on the same buttons as the approval dialog.
// Setting a plan also snaps the monthly fee to that tier's standard price —
// unless the coach set a custom rate, which setStudentPlan preserves.
export function PlanCard({
  student,
}: {
  student: {
    id: string;
    service_type: string | null;
    weekly_class_limit: number | null;
  };
}) {
  const active = currentPlan({
    service_type: student.service_type,
    weekly_class_limit: student.weekly_class_limit,
  });
  const activeOption = PLAN_OPTIONS.find((o) => o.plan === active);

  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState<Plan | null>(null);
  const router = useRouter();

  function choose(plan: Plan, label: string) {
    if (plan === active || pending) return;
    setSaving(plan);
    startTransition(async () => {
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
      } finally {
        setSaving(null);
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
          const isSaving = saving === opt.plan;
          return (
            <button
              key={opt.plan}
              type="button"
              disabled={pending || isActive}
              onClick={() => choose(opt.plan, opt.label)}
              aria-pressed={isActive}
              className={`flex h-12 w-full items-center justify-between rounded-md border px-4 text-left transition-colors ${
                isActive
                  ? "border-foreground bg-muted/40"
                  : "border-border/60 hover:border-foreground hover:bg-muted/40 active:bg-muted/60"
              } ${pending && !isActive ? "opacity-50" : ""}`}
            >
              <span className="text-sm font-medium">
                {opt.label}
                {isActive && <span className="ml-2">✓</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {isSaving ? "A guardar…" : opt.detail}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        O plano define o limite de aulas por semana e a mensalidade. Um valor à
        parte (na secção abaixo) é mantido.
      </p>
    </section>
  );
}
