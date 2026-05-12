import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { createSoloSession } from "../actions";

export default function NewSessionPage() {
  // Default to "now" rounded to next hour, formatted for datetime-local.
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const defaultDateTime = now.toISOString().slice(0, 16);

  return (
    <div className="max-w-2xl p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        1:1s
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        NOVA SESSÃO
      </h1>

      <form action={createSoloSession} className="mt-10 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="session_date">Data e hora</Label>
          <Input
            id="session_date"
            name="session_date"
            type="datetime-local"
            defaultValue={defaultDateTime}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="student">Aluno</Label>
          <Input
            id="student"
            name="student"
            placeholder="Email ou nome (deixa vazio se sem conta)"
          />
          <p className="text-xs text-muted-foreground">
            Se o email/nome corresponder a uma conta existente, a sessão é
            associada a esse aluno. Caso contrário, fica registada com o nome
            que escreveres.
          </p>
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
              type="text"
              inputMode="decimal"
              placeholder="ex: 25"
              defaultValue="25"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="ex: trabalho de combinações, focar defesa"
          />
        </div>

        <div className="flex flex-col-reverse items-stretch gap-3 pt-4 sm:flex-row sm:items-center">
          <SubmitButton className="h-11 text-base" pendingText="A criar…">
            Criar sessão
          </SubmitButton>
          <Link
            href="/admin/sessions"
            className="text-center text-sm text-muted-foreground hover:text-foreground sm:text-left"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
