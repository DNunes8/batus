import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StudentsList, type StudentProfile } from "./students-list";

export const dynamic = "force-dynamic";

// "19/07/2026" from "2026-07-19" — compact PT date for the guests list.
function ptDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export default async function StudentsPage() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: guestRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, phone, is_admin, is_blocked, approved, joined_at",
      )
      .order("joined_at", { ascending: false }),
    // Trial-class history ("aulas experimentais") — every guest the coach
    // added to a class, grouped by name below. Admin-only RLS.
    supabase
      .from("class_guests")
      .select("name, instance_date")
      .order("instance_date", { ascending: false }),
  ]);

  // Group guests case-insensitively: same name = same person, count visits.
  const guestGroups = new Map<
    string,
    { name: string; visits: number; last: string }
  >();
  for (const g of guestRows ?? []) {
    const key = g.name.trim().toLowerCase();
    const existing = guestGroups.get(key);
    if (existing) {
      existing.visits += 1;
      if (g.instance_date > existing.last) existing.last = g.instance_date;
    } else {
      guestGroups.set(key, {
        name: g.name.trim(),
        visits: 1,
        last: g.instance_date,
      });
    }
  }
  const guests = [...guestGroups.values()].sort((a, b) =>
    b.last.localeCompare(a.last),
  );

  const list = (profiles ?? []) as StudentProfile[];

  // Float pending (unapproved, non-admin) accounts to the top so the coach
  // sees who needs action first; the rest stay newest-first.
  list.sort((a, b) => {
    const aPending = !a.approved && !a.is_admin;
    const bPending = !b.approved && !b.is_admin;
    if (aPending !== bPending) return aPending ? -1 : 1;
    return b.joined_at.localeCompare(a.joined_at);
  });

  const pendingCount = list.filter(
    (p) => !p.approved && !p.is_admin,
  ).length;

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Alunos
        </p>
        <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
          ALUNOS
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {list.length}{" "}
          {list.length === 1 ? "conta registada" : "contas registadas"}
          {pendingCount > 0 && (
            <>
              {" · "}
              <span className="font-medium text-foreground">
                {pendingCount} a aguardar aprovação
              </span>
            </>
          )}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-md border border-dashed border-border/60 px-6 py-16 text-center">
          <Users className="size-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">
            Sem alunos registados ainda.
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
            Os alunos aparecem aqui automaticamente quando criam conta no site.
          </p>
        </div>
      ) : (
        <StudentsList profiles={list} />
      )}

      {/* Aulas experimentais — quiet, collapsed; the coach's follow-up list.
          People he added by name to classes: who tried, how often, when last. */}
      {guests.length > 0 && (
        <details className="mt-12 rounded-md border border-border/60">
          <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
            Aulas experimentais ({guests.length})
          </summary>
          <div className="border-t border-border/60 px-4 py-3">
            <ul className="divide-y divide-border/40">
              {guests.map((g) => (
                <li
                  key={g.name.toLowerCase()}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">
                    {g.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {g.visits} {g.visits === 1 ? "aula" : "aulas"} · última{" "}
                    {ptDate(g.last)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Adiciona pessoas pelo calendário (Adicionar pessoa numa aula).
              Quem experimentou e nunca criou conta é boa pessoa para
              contactar.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
