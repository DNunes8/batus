import Link from "next/link";
import { UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/money";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  session_date: string;
  duration_minutes: number;
  price_cents: number;
  notes: string | null;
  student_name: string | null;
  profile: { id: string; full_name: string | null; email: string } | null;
};

export default async function SessionsPage() {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("solo_sessions")
    .select(
      `id, session_date, duration_minutes, price_cents, notes, student_name,
       profile:profiles(id, full_name, email)`,
    )
    .order("session_date", { ascending: false })
    .limit(100);

  const rows = (sessions ?? []) as unknown as SessionRow[];

  return (
    <div className="p-6 sm:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            1:1s
          </p>
          <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
            SESSÕES INDIVIDUAIS
          </h1>
        </div>
        <Button
          render={<Link href="/admin/sessions/new" />}
          nativeButton={false}
        >
          Nova sessão
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-md border border-dashed border-border/60 px-6 py-16 text-center">
          <UserRound className="size-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">
            Ainda não tens sessões registadas.
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
            Sessões 1:1 são registadas aqui — ficam fora do horário público.
          </p>
          <Button
            render={<Link href="/admin/sessions/new" />}
            nativeButton={false}
            className="mt-6"
          >
            Nova sessão
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="mt-10 hidden overflow-x-auto rounded-md border border-border/60 md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Aluno</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Duração</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((s) => {
                  const name =
                    s.profile?.full_name ||
                    s.profile?.email ||
                    s.student_name ||
                    "—";
                  const date = new Date(s.session_date).toLocaleString("pt-PT", {
                    dateStyle: "short",
                    timeStyle: "short",
                  });
                  return (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 tabular-nums">{date}</td>
                      <td className="px-4 py-3 font-medium">{name}</td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {s.duration_minutes} min
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatEuro(s.price_cents)}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {s.notes || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <ul className="mt-8 space-y-3 md:hidden">
            {rows.map((s) => {
              const name =
                s.profile?.full_name ||
                s.profile?.email ||
                s.student_name ||
                "—";
              const date = new Date(s.session_date).toLocaleString("pt-PT", {
                dateStyle: "short",
                timeStyle: "short",
              });
              return (
                <li
                  key={s.id}
                  className="rounded-md border border-border/60 bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {date}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium tabular-nums">
                        {formatEuro(s.price_cents)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {s.duration_minutes} min
                      </p>
                    </div>
                  </div>
                  {s.notes && (
                    <p className="mt-3 border-t border-border/40 pt-2 text-xs text-muted-foreground">
                      {s.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
