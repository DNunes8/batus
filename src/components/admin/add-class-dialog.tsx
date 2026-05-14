"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { formatEuro } from "@/lib/money";
import {
  createClassFromCalendar,
  createGroupInstanceFromTemplate,
  createSoloFromCalendar,
  createSoloInstanceFromTemplate,
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
const PT_DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
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

export type GroupTemplateLite = {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  capacity: number;
};

export type SoloTemplateLite = {
  id: string;
  label: string; // student full_name OR off-app student_name OR "Aluno"
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  price_cents: number;
};

type Mode = "pick" | "custom-group" | "custom-solo";

export function AddClassDialog({
  date,
  groupTemplates,
  soloTemplates,
}: {
  date: string;
  groupTemplates: GroupTemplateLite[];
  soloTemplates: SoloTemplateLite[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("pick");
  const [picking, startPicking] = useTransition();

  // Reset to pick mode every time the dialog reopens.
  useEffect(() => {
    if (open) setMode("pick");
  }, [open]);

  function pickGroupTemplate(t: GroupTemplateLite) {
    startPicking(async () => {
      try {
        await createGroupInstanceFromTemplate({
          template_id: t.id,
          date,
        });
        toast.success(`${t.name} adicionada a ${formatPtDate(date)}.`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível adicionar.",
        );
      }
    });
  }

  function pickSoloTemplate(t: SoloTemplateLite) {
    startPicking(async () => {
      try {
        await createSoloInstanceFromTemplate({
          template_id: t.id,
          date,
        });
        toast.success(`1:1 com ${t.label} adicionado.`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível adicionar.",
        );
      }
    });
  }

  const hasModels = groupTemplates.length > 0 || soloTemplates.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="group flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-foreground/20 bg-background/50 px-3 py-3 text-sm font-medium text-foreground transition-all hover:border-foreground hover:bg-foreground hover:text-background sm:py-2 sm:text-xs">
        <Plus className="size-4 transition-transform group-hover:rotate-90" />
        Adicionar
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* Sticky header so the X close never overlaps content while scrolling */}
        <DialogHeader className="border-b border-border/60 px-6 pb-4 pr-12 pt-6">
          <DialogTitle>Adicionar ao calendário</DialogTitle>
          <p className="text-sm text-muted-foreground">{formatPtDate(date)}</p>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {mode === "pick" && (
            <PickView
              groupTemplates={groupTemplates}
              soloTemplates={soloTemplates}
              hasModels={hasModels}
              picking={picking}
              onPickGroup={pickGroupTemplate}
              onPickSolo={pickSoloTemplate}
              onChooseCustomGroup={() => setMode("custom-group")}
              onChooseCustomSolo={() => setMode("custom-solo")}
              onCancel={() => setOpen(false)}
            />
          )}

          {mode === "custom-group" && (
            <GroupForm
              key="group"
              date={date}
              onBack={() => setMode("pick")}
              onSuccess={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          )}

          {mode === "custom-solo" && (
            <SoloForm
              key="solo"
              date={date}
              onBack={() => setMode("pick")}
              onSuccess={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Pick view: model cards + escape hatches to the custom forms
// ----------------------------------------------------------------------------

function PickView({
  groupTemplates,
  soloTemplates,
  hasModels,
  picking,
  onPickGroup,
  onPickSolo,
  onChooseCustomGroup,
  onChooseCustomSolo,
  onCancel,
}: {
  groupTemplates: GroupTemplateLite[];
  soloTemplates: SoloTemplateLite[];
  hasModels: boolean;
  picking: boolean;
  onPickGroup: (t: GroupTemplateLite) => void;
  onPickSolo: (t: SoloTemplateLite) => void;
  onChooseCustomGroup: () => void;
  onChooseCustomSolo: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-5">
      {!hasModels && (
        <p className="text-sm text-muted-foreground">
          Ainda não tens modelos guardados. Cria um agora — fica disponível em
          todas as próximas adições.
        </p>
      )}

      {groupTemplates.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Aulas de grupo
          </p>
          <ul className="mt-2 space-y-2">
            {groupTemplates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onPickGroup(t)}
                  disabled={picking}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-3 text-left transition-colors hover:border-foreground hover:bg-muted/40 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {t.name}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {PT_DAYS_SHORT[t.day_of_week]} {t.start_time.slice(0, 5)} ·{" "}
                      {t.duration_minutes}min · {t.capacity} lugares
                    </span>
                  </span>
                  <span className="shrink-0 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {soloTemplates.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            1:1s
          </p>
          <ul className="mt-2 space-y-2">
            {soloTemplates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onPickSolo(t)}
                  disabled={picking}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-3 text-left transition-colors hover:border-foreground hover:bg-muted/40 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {t.label}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {PT_DAYS_SHORT[t.day_of_week]} {t.start_time.slice(0, 5)} ·{" "}
                      {t.duration_minutes}min · {formatEuro(t.price_cents)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2 border-t border-border/40 pt-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {hasModels ? "Ou criar do zero" : "Criar do zero"}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onChooseCustomGroup}
          disabled={picking}
          className="h-11 w-full justify-start text-base"
        >
          + Aula de grupo personalizada
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onChooseCustomSolo}
          disabled={picking}
          className="h-11 w-full justify-start text-base"
        >
          + 1:1 personalizado
        </Button>
      </section>

      <div className="border-t border-border/40 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className={`w-full ${BUTTON_MOBILE_CLASSES}`}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Custom group form — unchanged from before, just wrapped + ← Voltar header
// ----------------------------------------------------------------------------

function GroupForm({
  date,
  onBack,
  onSuccess,
}: {
  date: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState<CalendarActionState, FormData>(
    createClassFromCalendar,
    null,
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
      >
        ← Voltar aos modelos
      </button>

      <form action={action} className="space-y-4">
        <input type="hidden" name="date" value={date} />

        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" required placeholder="ex: Boxe Open" />
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
            onClick={onBack}
            className={BUTTON_MOBILE_CLASSES}
          >
            Voltar
          </Button>
          <SubmitButton className={BUTTON_MOBILE_CLASSES} pendingText="A criar…">
            Criar aula
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Custom solo form — unchanged from before, just wrapped + ← Voltar header
// ----------------------------------------------------------------------------

function SoloForm({
  date,
  onBack,
  onSuccess,
}: {
  date: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState<CalendarActionState, FormData>(
    createSoloFromCalendar,
    null,
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
      >
        ← Voltar aos modelos
      </button>

      <form action={action} className="space-y-4">
        <input type="hidden" name="date" value={date} />

        <div className="space-y-2">
          <Label htmlFor="student">Aluno</Label>
          <Input
            id="student"
            name="student"
            required
            placeholder="Email ou nome do aluno"
          />
          <p className="text-xs text-muted-foreground">
            Se o email ou nome corresponder a uma conta existente, o 1:1 fica
            associado a esse aluno. Caso contrário, fica registado com o nome
            escrito.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
            onClick={onBack}
            className={BUTTON_MOBILE_CLASSES}
          >
            Voltar
          </Button>
          <SubmitButton className={BUTTON_MOBILE_CLASSES} pendingText="A criar…">
            Criar 1:1
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
