"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import {
  createClassFromCalendar,
  createSoloFromCalendar,
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

const BUTTON_MOBILE_CLASSES = "h-11 text-base sm:h-9 sm:text-sm";

type Kind = "group" | "solo";

export function AddClassDialog({ date }: { date: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("group");

  const [groupState, groupAction] = useActionState<CalendarActionState, FormData>(
    createClassFromCalendar,
    null,
  );
  const [soloState, soloAction] = useActionState<CalendarActionState, FormData>(
    createSoloFromCalendar,
    null,
  );

  useEffect(() => {
    if (groupState?.success || soloState?.success) {
      setOpen(false);
      // revalidatePath in the server action invalidates the cache server-side,
      // but the client router still has the previous render. Force a refresh
      // so the new class actually appears in the day card.
      router.refresh();
    }
  }, [groupState, soloState, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="group flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-foreground/20 bg-background/50 px-3 py-3 text-sm font-medium text-foreground transition-all hover:border-foreground hover:bg-foreground hover:text-background sm:py-2 sm:text-xs">
        <Plus className="size-4 transition-transform group-hover:rotate-90" />
        Adicionar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar ao calendário</DialogTitle>
          <p className="text-sm text-muted-foreground">{formatPtDate(date)}</p>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="kind">Tipo</Label>
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className={SELECT_CLASSES}
          >
            <option value="group">Aula de grupo</option>
            <option value="solo">1:1 individual</option>
          </select>
        </div>

        {kind === "group" ? (
          <GroupForm
            key="group"
            date={date}
            action={groupAction}
            state={groupState}
            onCancel={() => setOpen(false)}
          />
        ) : (
          <SoloForm
            key="solo"
            date={date}
            action={soloAction}
            state={soloState}
            onCancel={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupForm({
  date,
  action,
  state,
  onCancel,
}: {
  date: string;
  action: (formData: FormData) => void;
  state: CalendarActionState;
  onCancel: () => void;
}) {
  return (
    <form action={action} className="space-y-4">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <input type="checkbox" name="repeat_weekly" className="mt-0.5" />
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
          onClick={onCancel}
          className={BUTTON_MOBILE_CLASSES}
        >
          Cancelar
        </Button>
        <SubmitButton className={BUTTON_MOBILE_CLASSES} pendingText="A criar…">
          Criar aula
        </SubmitButton>
      </div>
    </form>
  );
}

function SoloForm({
  date,
  action,
  state,
  onCancel,
}: {
  date: string;
  action: (formData: FormData) => void;
  state: CalendarActionState;
  onCancel: () => void;
}) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="date" value={date} />

      <div className="space-y-2">
        <Label htmlFor="student">Aluno</Label>
        <Input
          id="student"
          name="student"
          required
          autoFocus
          placeholder="Email ou nome do aluno"
        />
        <p className="text-xs text-muted-foreground">
          Se o email ou nome corresponder a uma conta existente, o 1:1 fica
          associado a esse aluno. Caso contrário, fica registado com o nome
          escrito.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_time">Hora</Label>
          <Input
            id="start_time"
            name="start_time"
            type="time"
            defaultValue="19:00"
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

      <div className="space-y-2">
        <Label htmlFor="price">Valor (€)</Label>
        <Input
          id="price"
          name="price"
          inputMode="decimal"
          placeholder="ex: 25"
          defaultValue="25"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="ex: trabalho de combinações, foco defesa"
        />
      </div>

      <label className="flex items-start gap-2 rounded-md border border-border/60 p-3 text-sm">
        <input
          type="checkbox"
          name="repeat_weekly"
          className="mt-0.5"
          defaultChecked
        />
        <span>
          <span className="font-medium">Repetir todas as semanas</span>
          <span className="block text-xs text-muted-foreground">
            1:1s costumam ser slots fixos. Desmarca se for único.
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
          onClick={onCancel}
          className={BUTTON_MOBILE_CLASSES}
        >
          Cancelar
        </Button>
        <SubmitButton className={BUTTON_MOBILE_CLASSES} pendingText="A criar…">
          Criar 1:1
        </SubmitButton>
      </div>
    </form>
  );
}
