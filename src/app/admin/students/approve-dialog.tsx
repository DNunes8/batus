"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { approveStudentWithPlan, type ApprovalPlan } from "./actions";

// Approve-with-plan: tapping "Aprovar" opens this dialog so the coach picks
// the student's plan in the same gesture — no second step to forget. Built
// mobile-first: big full-width stacked buttons, generous tap targets.

const PLAN_OPTIONS: Array<{
  plan: ApprovalPlan;
  label: string;
  detail: string;
}> = [
  { plan: "1", label: "1 aula por semana", detail: "Grupo · 25€/mês" },
  { plan: "2", label: "2 aulas por semana", detail: "Grupo · 35€/mês" },
  { plan: "3", label: "3 aulas por semana", detail: "Grupo · 50€/mês" },
  { plan: "livre", label: "Livre", detail: "Grupo · 60€/mês" },
  { plan: "pt", label: "PT", detail: "Sessões individuais" },
];

export function ApproveDialog({
  student,
  buttonClassName,
  buttonLabel,
}: {
  student: { id: string; name: string };
  buttonClassName: string;
  buttonLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function choose(plan: ApprovalPlan, label: string) {
    startTransition(async () => {
      try {
        const result = await approveStudentWithPlan({ id: student.id, plan });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`${student.name} aprovado — ${label}.`);
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Não foi possível aprovar. Tenta novamente.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        {buttonLabel}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] w-full gap-0 overflow-y-auto p-0 sm:max-w-sm">
          <DialogHeader className="border-b border-border/60 py-4 pl-5 pr-12">
            <DialogTitle className="break-words text-left">
              Aprovar {student.name}
            </DialogTitle>
            <p className="text-left text-sm text-muted-foreground">
              Que plano tem este aluno?
            </p>
          </DialogHeader>

          <div className="space-y-2 px-5 py-4">
            {PLAN_OPTIONS.map((opt) => (
              <button
                key={opt.plan}
                type="button"
                disabled={pending}
                onClick={() => choose(opt.plan, opt.label)}
                className="flex h-14 w-full items-center justify-between rounded-md border border-border/60 px-4 text-left transition-colors hover:border-foreground hover:bg-muted/40 active:bg-muted/60 disabled:opacity-50"
              >
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {opt.detail}
                </span>
              </button>
            ))}
          </div>

          <p className="border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
            Podes mudar o plano ou o valor a qualquer altura, em Pagamentos.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
