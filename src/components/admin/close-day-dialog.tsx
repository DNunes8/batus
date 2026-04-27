"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { setClosedDay } from "@/app/admin/calendar/actions";

const PT_DAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const PT_MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function formatPtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  return `${PT_DAYS[date.getUTCDay()]}, ${day} ${PT_MONTHS[m - 1]}`;
}

export function CloseDayDialog({ date }: { date: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="w-full py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground">
        Fechar dia
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar dia</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {formatPtDate(date)} — todas as aulas vão aparecer canceladas para
            os alunos.
          </p>
        </DialogHeader>

        <form action={setClosedDay} className="space-y-4">
          <input type="hidden" name="date" value={date} />

          <div className="space-y-2">
            <Label htmlFor="reason">Razão (visível para os alunos)</Label>
            <Input
              id="reason"
              name="reason"
              autoFocus
              placeholder="ex: Feriado · Doença · Manutenção"
            />
            <p className="text-xs text-muted-foreground">
              Se não preencheres, aparece só "Fechado".
            </p>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Voltar
            </Button>
            <SubmitButton pendingText="A fechar…" variant="destructive">
              Fechar dia
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
