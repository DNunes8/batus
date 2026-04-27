import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClassTemplate } from "../actions";

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

export default function NewClassPage() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Aulas
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        NOVA AULA
      </h1>

      <form action={createClassTemplate} className="mt-10 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            name="name"
            required
            autoFocus
            placeholder="ex: Boxe Iniciados"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            placeholder="ex: Aula para alunos que estão a começar"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
              defaultValue="18:00"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="active_from">Ativa a partir de</Label>
            <Input
              id="active_from"
              name="active_from"
              type="date"
              defaultValue={today}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="active_until">Ativa até (opcional)</Label>
            <Input id="active_until" name="active_until" type="date" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit">Criar aula</Button>
          <Link
            href="/admin/classes"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
