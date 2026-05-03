"use client";

import { useActionState, useEffect, useState } from "react";
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
import {
  createClassFromCalendar,
  type CalendarActionState,
} from "@/app/admin/calendar/actions";

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
  return `${PT_DAYS[date.getUTCDay()]}, ${day} ${PT_MONTHS[m - 1]} ${y}`;
}

const SELECT_CLASSES =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function AddClassDialog({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<CalendarActionState, FormData>(
    createClassFromCalendar,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border/60 px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted hover:text-foreground sm:py-2 sm:text-xs"
      >
        + Adicionar aula
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova aula</DialogTitle>
          <p className="text-sm text-muted-foreground">{formatPtDate(date)}</p>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="date" value={date} />

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              required
              autoFocus
              placeholder="ex: Boxe Open"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start_time">Hora</Label>
              <Input
                id="start_time"
                name="start_time"
                type="time"
                defaultValue="18:00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duração (min)</Label>
              <Input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                min={15}
                max={240}
                defaultValue={60}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacidade</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                max={100}
                defaultValue={12}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="is_public">Visibilidade</Label>
              <select
                id="is_public"
                name="is_public"
                defaultValue="true"
                className={SELECT_CLASSES}
              >
                <option value="true">Pública</option>
                <option value="false">Só membros</option>
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border/60 p-3 text-sm">
            <input
              type="checkbox"
              name="repeat_weekly"
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Repetir todas as semanas</span>
              <span className="block text-xs text-muted-foreground">
                Cria um modelo recorrente em vez de uma aula única.
              </span>
            </span>
          </label>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <SubmitButton pendingText="A criar…">Criar aula</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
