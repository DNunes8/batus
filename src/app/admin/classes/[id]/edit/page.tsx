import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { updateClassTemplate } from "../../actions";

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

export default async function EditClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("class_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (!t) notFound();

  return (
    <div className="max-w-2xl p-6 sm:p-10">
      <Link
        href="/admin/classes"
        className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        ← Modelos
      </Link>
      <h1 className="mt-3 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        EDITAR AULA
      </h1>

      <form action={updateClassTemplate} className="mt-10 space-y-5">
        <input type="hidden" name="id" value={t.id} />

        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={t.name}
            placeholder="ex: Boxe Iniciados"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={t.description ?? ""}
            placeholder="ex: Aula para alunos que estão a começar"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="day_of_week">Dia da semana</Label>
            <select
              id="day_of_week"
              name="day_of_week"
              defaultValue={String(t.day_of_week)}
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
              defaultValue={t.start_time.slice(0, 5)}
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
              defaultValue={t.duration_minutes}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacidade</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              max={100}
              defaultValue={t.capacity}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="active_from">Ativa a partir de</Label>
            <Input
              id="active_from"
              name="active_from"
              type="date"
              defaultValue={t.active_from}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="active_until">Ativa até (opcional)</Label>
            <Input
              id="active_until"
              name="active_until"
              type="date"
              defaultValue={t.active_until ?? ""}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="is_public">Visibilidade</Label>
          <select
            id="is_public"
            name="is_public"
            defaultValue={t.is_public === false ? "false" : "true"}
            className={SELECT_CLASSES}
          >
            <option value="true">Pública — visível no horário público</option>
            <option value="false">Só membros — só alunos com sessão iniciada</option>
          </select>
        </div>

        <div className="flex flex-col-reverse items-stretch gap-3 pt-4 sm:flex-row sm:items-center">
          <SubmitButton className="h-11 text-base" pendingText="A guardar…">
            Guardar alterações
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
