import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StudentsList, type StudentProfile } from "./students-list";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, phone, is_admin, is_blocked, approved, joined_at",
    )
    .order("joined_at", { ascending: false });

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
    </div>
  );
}
