import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { createSoloTemplate } from "../../actions";

const DAYS = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const SELECT_CLASSES =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default function NewPtTemplatePage() {
  return (
    <div className="max-w-2xl p-6 sm:p-10">
      <Link
        href="/admin/classes"
        className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        ← Modelos
      </Link>
      <h1 className="mt-3 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        NOVO PT
      </h1>

      <form action={createSoloTemplate} className="mt-10 space-y-5">
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
            Se corresponder a uma conta existente, o PT fica associado a esse
            aluno. Caso contrário, fica registado com o nome escrito.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mode">Tipo</Label>
          <select
            id="mode"
            name="mode"
            defaultValue="preset"
            className={SELECT_CLASSES}
          >
            <option value="preset">
              Preset — só entra no calendário quando o adicionas
            </option>
            <option value="recurring">
              Recorrente — entra no calendário todas as semanas
            </option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="day_of_week">Dia da semana</Label>
            <select
              id="day_of_week"
              name="day_of_week"
              defaultValue="1"
              required
              className={SELECT_CLASSES}
            >
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="start_time">Hora</Label>
            <Input
              id="start_time"
              name="start_time"
              type="time"
              required
              defaultValue="19:00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <div className="space-y-2">
            <Label htmlFor="price">Valor (€)</Label>
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              defaultValue="25"
              required
              placeholder="ex: 25"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="ex: foco em técnica de defesa"
          />
        </div>

        <div className="flex flex-col-reverse items-stretch gap-3 pt-4 sm:flex-row sm:items-center">
          <SubmitButton className="h-11 text-base" pendingText="A criar…">
            Criar PT
          </SubmitButton>
          <Link
            href="/admin/classes"
            className="text-center text-sm text-muted-foreground hover:text-foreground sm:text-left"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
