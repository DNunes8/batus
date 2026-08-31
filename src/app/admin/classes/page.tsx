import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/confirm-form";
import { formatEuro } from "@/lib/money";
import { formatDayHeader, todayLisbon } from "@/lib/schedule";
import {
  CUTOFF_OPTIONS,
  cutoffLabel,
  getBookableUntil,
  getCancellationCutoffHours,
} from "@/lib/booking-window";
import {
  deleteClassTemplate,
  deleteSoloTemplate,
  openNextTwoWeeks,
} from "./actions";
import { assertAdminPage } from "@/lib/auth-guard";
import { CutoffChips } from "./cutoff-chips";

export const dynamic = "force-dynamic";

const DAY_LABEL: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

type PtTemplate = {
  id: string;
  student_name: string | null;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  price_cents: number;
  is_preset: boolean;
  profile: { full_name: string | null; email: string } | null;
};

export default async function ClassesListPage() {
  await assertAdminPage();
  const supabase = await createClient();

  const [classRes, ptRes] = await Promise.all([
    supabase
      .from("class_templates")
      .select("*")
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("solo_session_templates")
      .select(
        "id, student_name, day_of_week, start_time, duration_minutes, price_cents, is_preset, profile:profiles(full_name, email)",
      )
      // Definitions only — recurring PTs + presets. The placed one-off rows
      // (active_until set, not a preset) are calendar instances, not models.
      .or("is_preset.eq.true,active_until.is.null")
      .order("day_of_week")
      .order("start_time"),
  ]);

  const templates = classRes.data ?? [];
  const ptTemplates = (ptRes.data ?? []) as unknown as PtTemplate[];
  const bookableUntil = await getBookableUntil();
  const windowOpen = bookableUntil > todayLisbon();
  const cutoffHours = await getCancellationCutoffHours();

  return (
    <div className="p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Modelos
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        HORÁRIOS
      </h1>

      {/* ---------------------------------------------------------------- */}
      {/* Group classes */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl tracking-[0.04em] sm:text-2xl">
              Aulas de grupo
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Cada modelo é uma aula recorrente (ex: Boxe Iniciados, Segundas
              18:00). Os alunos só marcam dentro do período aberto — usa
              &quot;Abrir próximas 2 semanas&quot; para abrir o próximo bloco.
            </p>
          </div>
          <Button
            render={<Link href="/admin/classes/new" />}
            nativeButton={false}
          >
            Nova aula
          </Button>
        </div>

        {/* Booking window — the wife's fortnightly "open the next 2 weeks". */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-foreground/20 bg-muted/30 p-4">
          <p className="text-sm">
            {windowOpen ? (
              <>
                Marcações abertas até{" "}
                <strong>{formatDayHeader(bookableUntil)}</strong>.
              </>
            ) : (
              <>Marcações fechadas. Abre o próximo bloco de 2 semanas.</>
            )}
          </p>
          <ConfirmForm
            message="Abrir marcações para as próximas 2 semanas?"
            action={openNextTwoWeeks}
          >
            <button
              type="submit"
              className="h-11 rounded-md bg-foreground px-5 text-sm font-medium uppercase tracking-wider text-background transition-opacity hover:opacity-90"
            >
              Abrir próximas 2 semanas
            </button>
          </ConfirmForm>
        </div>

        {/* Cancellation cutoff — the coach's rule, in his own hands. Tap to
            choose (same gesture as the student plan buttons) rather than a
            number box: he reads the option instead of translating a number.
            Tap → confirm naming the option → live, with a toast saying which
            rule is now in force. */}
        <div className="mt-3 rounded-md border border-border/60 p-4">
          <p className="text-sm font-medium">Até quando podem desmarcar?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Depois disto o aluno já não vê o botão Cancelar e fala contigo.
          </p>
          <CutoffChips
            current={cutoffHours}
            options={CUTOFF_OPTIONS.map((h) => ({
              hours: h,
              label: cutoffLabel(h),
            }))}
          />
        </div>

        {templates.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed border-border/60 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não tens modelos de aula. Cria o primeiro.
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
          <div className="mt-6 overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Dia</th>
                  <th className="px-4 py-3 font-medium">Hora</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Duração
                  </th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Capacidade
                  </th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">
                    Período
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3">{DAY_LABEL[t.day_of_week]}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {t.start_time.slice(0, 5)}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {t.duration_minutes} min
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {t.capacity}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      Desde {t.active_from}
                      {t.active_until ? ` até ${t.active_until}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          render={
                            <Link href={`/admin/classes/${t.id}/edit`} />
                          }
                          nativeButton={false}
                          variant="outline"
                          size="sm"
                        >
                          Editar
                        </Button>
                        <ConfirmForm
                          message={`Apagar "${t.name}" para sempre? Só dá se nunca ninguém tiver marcado esta aula. Se já houve marcações, muda as datas para a desativar.`}
                          action={deleteClassTemplate}
                        >
                          <input type="hidden" name="id" value={t.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                          >
                            Apagar
                          </Button>
                        </ConfirmForm>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* PTs */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl tracking-[0.04em] sm:text-2xl">
              PTs
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Modelos de PT reutilizáveis. <strong>Recorrente</strong> entra no
              calendário todas as semanas; <strong>preset</strong> não entra
              sozinho — adiciona-lo pelo botão Adicionar do calendário, quando
              quiseres.
            </p>
          </div>
          <Button
            render={<Link href="/admin/classes/pts/new" />}
            nativeButton={false}
          >
            Novo PT
          </Button>
        </div>

        {ptTemplates.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed border-border/60 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não tens modelos de PT. Cria o primeiro.
            </p>
            <Button
              render={<Link href="/admin/classes/pts/new" />}
              nativeButton={false}
              className="mt-6"
            >
              Novo PT
            </Button>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Aluno</th>
                  <th className="px-4 py-3 font-medium">Modo</th>
                  <th className="px-4 py-3 font-medium">Dia</th>
                  <th className="px-4 py-3 font-medium">Hora</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Duração
                  </th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ptTemplates.map((t) => {
                  const name =
                    t.profile?.full_name ||
                    t.profile?.email ||
                    t.student_name ||
                    "Aluno";
                  return (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{name}</td>
                      <td className="px-4 py-3">
                        {t.is_preset ? (
                          <span className="inline-block rounded-sm border border-muted-foreground/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                            Preset
                          </span>
                        ) : (
                          <span className="inline-block rounded-sm border border-foreground/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-foreground">
                            Recorrente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{DAY_LABEL[t.day_of_week]}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {t.start_time.slice(0, 5)}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {t.duration_minutes} min
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatEuro(t.price_cents)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            render={
                              <Link
                                href={`/admin/classes/pts/${t.id}/edit`}
                              />
                            }
                            nativeButton={false}
                            variant="outline"
                            size="sm"
                          >
                            Editar
                          </Button>
                          <ConfirmForm
                            message={`Apagar o PT de ${name}? Não dá para desfazer.`}
                            action={deleteSoloTemplate}
                          >
                            <input type="hidden" name="id" value={t.id} />
                            <Button
                              type="submit"
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                            >
                              Apagar
                            </Button>
                          </ConfirmForm>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
