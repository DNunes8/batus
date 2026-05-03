import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, is_admin, is_blocked, joined_at")
    .order("joined_at", { ascending: false });

  return (
    <div className="p-6 sm:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Alunos
        </p>
        <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
          ALUNOS
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {profiles?.length ?? 0} contas registadas
        </p>
      </div>

      {!profiles || profiles.length === 0 ? (
        <p className="mt-12 text-sm text-muted-foreground">
          Sem alunos registados.
        </p>
      ) : (
        <div className="mt-10 overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Email</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Telefone</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Desde</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {profiles.map((p) => {
                const since = new Date(p.joined_at).toLocaleDateString("pt-PT", {
                  year: "numeric",
                  month: "short",
                });
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {p.full_name || (
                        <span className="text-muted-foreground">— sem nome —</span>
                      )}
                      {p.is_admin && (
                        <span className="ml-2 inline-block rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-background">
                          Admin
                        </span>
                      )}
                      {p.is_blocked && (
                        <span className="ml-2 inline-block rounded-sm bg-destructive/20 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-destructive">
                          Bloqueado
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {p.email}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {p.phone || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground tabular-nums lg:table-cell">
                      {since}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/students/${p.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
