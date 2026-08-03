"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addClassGuest, addStudentToClass } from "./actions";

// One student row for the picker — label precomputed server-side (plan tier /
// pack balance) so the client stays dumb.
export type StudentLite = {
  id: string;
  name: string;
  label: string;
};

// The roster ships ONCE through this provider instead of being re-serialized
// into every class card (20-45 GroupBlocks render at once on desktop).
const StudentsContext = createContext<StudentLite[]>([]);

export function StudentsProvider({
  students,
  children,
}: {
  students: StudentLite[];
  children: ReactNode;
}) {
  return (
    <StudentsContext.Provider value={students}>
      {children}
    </StudentsContext.Provider>
  );
}

// Accent-insensitive matching: "joao" finds "João".
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// The "+ Adicionar pessoa" flow on a class card. Type a name -> matching
// students appear (with their plan) -> picking one books them for real via
// addStudentToClass (two-step: informational warnings come back first and are
// confirmed with the phone's native popup — calm text, coach's call). No match
// -> fall back to the old guest add (a name with no account, e.g. aula
// experimental).
export function AddPersonPicker({
  template_id,
  instance_date,
  roster,
  pastDay = false,
}: {
  template_id: string;
  instance_date: string;
  // user_id -> status for people already in this class, to tag suggestions.
  roster: { user_id: string; status: "booked" | "waitlisted" }[];
  // Past classes: student adds are blocked (streaks/credits must not be
  // rewritten), but GUESTS stay allowed — logging yesterday's walk-in is
  // legitimate history-keeping, and guests are just names with no money.
  pastDay?: boolean;
}) {
  const students = useContext(StudentsContext);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const q = norm(query.trim());
  const hits = q.length >= 2 ? students.filter((s) => norm(s.name).includes(q)) : [];
  const statusOf = (id: string) => roster.find((r) => r.user_id === id)?.status;

  function reset() {
    setQuery("");
    setOpen(false);
  }

  function pick(student: StudentLite) {
    if (pending) return;
    startTransition(async () => {
      try {
        let result = await addStudentToClass({
          user_id: student.id,
          template_id,
          instance_date,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.warnings) {
          const ok = window.confirm(
            `Adicionar ${student.name}?\n\n${result.warnings.join("\n")}`,
          );
          if (!ok) return;
          result = await addStudentToClass({
            user_id: student.id,
            template_id,
            instance_date,
            confirmed: true,
          });
          if (result.error) {
            toast.error(result.error);
            return;
          }
        }
        // Only claim the email when the server confirmed Resend accepted it.
        toast.success(
          `${student.name.split(" ")[0]} adicionado${
            result.emailed ? " · email enviado" : ""
          }`,
        );
        reset();
        router.refresh();
      } catch {
        toast.error("Não foi possível adicionar. Tenta de novo.");
      }
    });
  }

  function addGuest() {
    const name = query.trim();
    if (!name || pending) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("template_id", template_id);
        fd.set("instance_date", instance_date);
        fd.set("name", name);
        await addClassGuest(fd);
        toast.success("Convidado adicionado");
        reset();
        router.refresh();
      } catch {
        toast.error("Não foi possível adicionar. Tenta de novo.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          // Focus after the input mounts.
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="mt-2 cursor-pointer text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
      >
        {pastDay ? "+ Adicionar convidado" : "+ Adicionar pessoa"}
      </button>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") reset();
          }}
          placeholder={pastDay ? "Nome do convidado…" : "Nome do aluno…"}
          autoComplete="off"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={reset}
          aria-label="Fechar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 text-base text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>

      {(pastDay ? query.trim().length >= 1 : q.length >= 2) && (
        <ul className="mt-1.5 max-h-56 divide-y divide-border/40 overflow-y-auto rounded-md border border-border/60">
          {!pastDay &&
            hits.map((s) => {
            const status = statusOf(s.id);
            const inClass = status === "booked";
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={inClass || pending}
                  onClick={() => pick(s)}
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/40 disabled:cursor-default disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {s.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {inClass
                      ? "já na aula"
                      : status === "waitlisted"
                        ? "em espera"
                        : s.label}
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              disabled={pending}
              onClick={addGuest}
              className="w-full px-2.5 py-2 text-left text-xs text-muted-foreground hover:bg-muted/40"
            >
              Adicionar “{query.trim()}” como convidado (sem conta)
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
