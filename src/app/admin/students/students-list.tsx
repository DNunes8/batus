"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ApproveDialog } from "./approve-dialog";

export type StudentProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_admin: boolean;
  is_blocked: boolean;
  approved: boolean;
  joined_at: string;
};

function formatSince(joinedAt: string): string {
  return new Date(joinedAt).toLocaleDateString("pt-PT", {
    year: "numeric",
    month: "short",
  });
}

// A non-admin account that the coach hasn't approved yet.
function isPending(p: StudentProfile): boolean {
  return !p.approved && !p.is_admin;
}

export function StudentsList({ profiles }: { profiles: StudentProfile[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      return (
        p.full_name?.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q)
      );
    });
  }, [query, profiles]);

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Procurar por nome, email ou telefone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-10 pr-10 text-base"
            aria-label="Procurar alunos"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar pesquisa"
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {filtered.length} {filtered.length === 1 ? "aluno" : "alunos"}
          {query && (
            <span className="hidden sm:inline"> de {profiles.length}</span>
          )}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-md border border-dashed border-border/60 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Sem alunos a corresponder a{" "}
            <span className="text-foreground">"{query}"</span>.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            Limpar pesquisa
          </button>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="mt-6 hidden overflow-x-auto rounded-md border border-border/60 md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Desde</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((p) => {
                  const pending = isPending(p);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-muted/30 ${
                        pending ? "bg-muted/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">
                        {p.full_name || (
                          <span className="text-muted-foreground">
                            — sem nome —
                          </span>
                        )}
                        {pending && (
                          <span className="ml-2 inline-block rounded-sm border border-foreground/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-foreground">
                            A aguardar
                          </span>
                        )}
                        {p.is_admin && (
                          <span className="ml-2 inline-block rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-background">
                            Admin
                          </span>
                        )}
                        {p.is_blocked && (
                          <span className="ml-2 inline-block rounded-sm border border-muted-foreground/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                            Em pausa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.email}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {formatSince(p.joined_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          {pending && (
                            <ApproveDialog
                              student={{
                                id: p.id,
                                name: p.full_name || p.email,
                              }}
                              buttonLabel="Aprovar"
                              buttonClassName="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-background transition-opacity hover:opacity-90"
                            />
                          )}
                          <Link
                            href={`/admin/students/${p.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            Ver →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <ul className="mt-6 space-y-3 md:hidden">
            {filtered.map((p) => {
              const pending = isPending(p);
              return (
                <li
                  key={p.id}
                  className={`overflow-hidden rounded-md border bg-background ${
                    pending ? "border-foreground/30" : "border-border/60"
                  }`}
                >
                  <Link
                    href={`/admin/students/${p.id}`}
                    className="block p-4 transition-colors hover:bg-muted/40 active:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {p.full_name || (
                            <span className="text-muted-foreground">
                              — sem nome —
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.email}
                        </p>
                        {p.phone && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {p.phone}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {pending && (
                          <span className="rounded-sm border border-foreground/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-foreground">
                            A aguardar
                          </span>
                        )}
                        {p.is_admin && (
                          <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-background">
                            Admin
                          </span>
                        )}
                        {p.is_blocked && (
                          <span className="rounded-sm border border-muted-foreground/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                            Em pausa
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        Desde {formatSince(p.joined_at)}
                      </span>
                      <span className="text-foreground/70">Ver →</span>
                    </div>
                  </Link>

                  {/* Approve action sits outside the Link — can't nest a
                      button inside an anchor. */}
                  {pending && (
                    <div className="border-t border-border/40 p-3">
                      <ApproveDialog
                        student={{ id: p.id, name: p.full_name || p.email }}
                        buttonLabel="Aprovar aluno"
                        buttonClassName="h-11 w-full rounded-md bg-foreground text-sm font-medium uppercase tracking-wider text-background transition-opacity hover:opacity-90"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
