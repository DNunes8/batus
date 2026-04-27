import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

const DAY_LABEL: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

export default async function ClassesListPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("class_templates")
    .select("*")
    .order("day_of_week")
    .order("start_time");

  return (
    <div className="p-6 sm:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Aulas
          </p>
          <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
            HORÁRIOS
          </h1>
        </div>
        <Button
          render={<Link href="/admin/classes/new" />}
          nativeButton={false}
        >
          Nova aula
        </Button>
      </div>

      {!templates || templates.length === 0 ? (
        <div className="mt-12 rounded-md border border-dashed border-border/60 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Ainda não tens aulas. Cria a primeira.
          </p>
          <Button
            render={<Link href="/admin/classes/new" />}
            nativeButton={false}
            className="mt-6"
          >
            Nova aula
          </Button>
        </div>
      ) : (
        <div className="mt-10 overflow-hidden rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Dia</th>
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Duração</th>
                <th className="px-4 py-3 font-medium">Capacidade</th>
                <th className="px-4 py-3 font-medium">Período</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">{DAY_LABEL[t.day_of_week]}</td>
                  <td className="px-4 py-3">{t.start_time.slice(0, 5)}</td>
                  <td className="px-4 py-3">{t.duration_minutes} min</td>
                  <td className="px-4 py-3">{t.capacity}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Desde {t.active_from}
                    {t.active_until ? ` até ${t.active_until}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
