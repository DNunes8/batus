import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEuro, formatMonthYear } from "@/lib/money";
import { ConfirmForm } from "@/components/confirm-form";
import { StatusPill } from "@/app/admin/pagamentos/status-pill";
import type { PaymentStatus } from "@/app/admin/pagamentos/actions";
import { approveStudent } from "../actions";
import {
  setStudentPaused,
  togglePaymentStatus,
  updateStudentNotesAndGoals,
  upsertPaymentRecord,
} from "./actions";

const SELECT_CLASSES =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [profileRes, paymentsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase
      .from("payment_records")
      .select("*")
      .eq("user_id", id)
      .order("month", { ascending: false }),
  ]);

  const profile = profileRes.data;
  if (!profile) notFound();

  const payments = paymentsRes.data ?? [];

  const since = new Date(profile.joined_at).toLocaleDateString("pt-PT", {
    year: "numeric",
    month: "long",
  });

  // Default month for "add payment" form: this month.
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="max-w-3xl p-6 sm:p-10">
      <Link
        href="/admin/students"
        className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        ← Alunos
      </Link>
      <h1 className="mt-3 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        {(profile.full_name || profile.email).toUpperCase()}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {profile.email} · Aluno desde {since}
      </p>

      {/* Approval gate — a pending student can't book until approved here. */}
      {!profile.approved && !profile.is_admin && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-foreground/30 bg-muted/40 p-4">
          <div>
            <p className="text-sm font-medium">Conta a aguardar aprovação</p>
            <p className="text-xs text-muted-foreground">
              Este aluno não pode marcar aulas enquanto não for aprovado.
            </p>
          </div>
          <ConfirmForm
            message={`Aprovar ${
              profile.full_name || profile.email
            }? Vai poder marcar aulas.`}
            action={approveStudent}
          >
            <input type="hidden" name="id" value={profile.id} />
            <button
              type="submit"
              className="h-11 rounded-md bg-foreground px-5 text-sm font-medium uppercase tracking-wider text-background transition-opacity hover:opacity-90"
            >
              Aprovar
            </button>
          </ConfirmForm>
        </div>
      )}

      {/* Pause control — a paused account stays registered but can't book new
          classes. Shown for approved, non-admin students; a pending student
          is gated by the approval panel above instead. */}
      {profile.approved &&
        !profile.is_admin &&
        (profile.is_blocked ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-foreground/30 bg-muted/40 p-4">
            <div>
              <p className="text-sm font-medium">Conta em pausa</p>
              <p className="text-xs text-muted-foreground">
                Este aluno não pode marcar aulas. As marcações que já tem
                mantêm-se.
              </p>
            </div>
            <ConfirmForm
              message={`Reativar ${
                profile.full_name || profile.email
              }? Vai poder voltar a marcar aulas.`}
              action={setStudentPaused}
            >
              <input type="hidden" name="id" value={profile.id} />
              <input type="hidden" name="paused" value="false" />
              <button
                type="submit"
                className="h-11 rounded-md bg-foreground px-5 text-sm font-medium uppercase tracking-wider text-background transition-opacity hover:opacity-90"
              >
                Reativar conta
              </button>
            </ConfirmForm>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-4">
            <div>
              <p className="text-sm font-medium">Conta ativa</p>
              <p className="text-xs text-muted-foreground">
                Este aluno pode marcar aulas normalmente.
              </p>
            </div>
            <ConfirmForm
              message={`Pôr ${
                profile.full_name || profile.email
              } em pausa? Não vai poder marcar aulas.`}
              action={setStudentPaused}
            >
              <input type="hidden" name="id" value={profile.id} />
              <input type="hidden" name="paused" value="true" />
              <button
                type="submit"
                className="h-11 rounded-md border border-foreground/30 px-5 text-sm font-medium uppercase tracking-wider transition-colors hover:bg-muted"
              >
                Pôr em pausa
              </button>
            </ConfirmForm>
          </div>
        ))}

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Perfil
        </h2>
        <form
          action={updateStudentNotesAndGoals}
          className="mt-4 space-y-4 rounded-md border border-border/60 p-4"
        >
          <input type="hidden" name="id" value={profile.id} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile.full_name ?? ""}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={profile.phone ?? ""}
                placeholder="9XX XXX XXX"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service_type">Tipo</Label>
              <select
                id="service_type"
                name="service_type"
                defaultValue={profile.service_type ?? "group"}
                className={SELECT_CLASSES}
              >
                <option value="group">Aulas de grupo</option>
                <option value="solo">PTs</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Determina o separador onde o aluno aparece em Pagamentos.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_fee">Mensalidade (€)</Label>
              <Input
                id="monthly_fee"
                name="monthly_fee"
                inputMode="decimal"
                defaultValue={
                  profile.monthly_fee_cents != null
                    ? (profile.monthly_fee_cents / 100)
                        .toFixed(2)
                        .replace(".", ",")
                    : ""
                }
                placeholder="Em branco = padrão"
              />
              <p className="text-xs text-muted-foreground">
                Em branco usa a mensalidade padrão definida em Pagamentos.
              </p>
            </div>
          </div>
          <label className="flex items-start gap-2 rounded-md border border-border/60 p-3 text-sm">
            <input
              type="checkbox"
              name="has_monthly_fee"
              defaultChecked={profile.has_monthly_fee ?? true}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Tem pagamento mensal</span>
              <span className="block text-xs text-muted-foreground">
                Desliga só para alunos PT que pagam à sessão (cash no dia). Nesse
                caso a Pagamentos não exige Marcar pago todos os meses.
              </span>
            </span>
          </label>
          <div className="space-y-2">
            <Label htmlFor="goals">Objetivos</Label>
            <Textarea
              id="goals"
              name="goals"
              rows={2}
              defaultValue={profile.goals ?? ""}
              placeholder="ex: perder peso, melhorar técnica"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas privadas</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={profile.notes ?? ""}
              placeholder="Visíveis só para o admin"
            />
          </div>
          <Button type="submit" className="h-11 text-base">
            Guardar
          </Button>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Pagamentos
        </h2>

        <p className="mt-4 text-xs text-muted-foreground">
          Vista detalhada por aluno. Para marcar pagamentos do mês em massa, usa{" "}
          <Link
            href="/admin/pagamentos"
            className="underline hover:text-foreground"
          >
            Pagamentos
          </Link>
          .
        </p>

        {payments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Sem registos de pagamento.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Mês</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium">Notas</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payments.map((p) => {
                  const status: PaymentStatus =
                    (p.status as PaymentStatus | undefined) ??
                    (p.paid_at ? "paid" : "unpaid");
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2 font-medium">
                        {formatMonthYear(p.month)}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {formatEuro(p.amount_cents)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <StatusPill status={status} />
                          {status === "paid" && p.paid_at && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              em{" "}
                              {new Date(p.paid_at).toLocaleDateString("pt-PT")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {p.notes || "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <form action={togglePaymentStatus}>
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            type="hidden"
                            name="user_id"
                            value={profile.id}
                          />
                          <input
                            type="hidden"
                            name="current_status"
                            value={status}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            Mudar estado
                          </Button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <form
          action={upsertPaymentRecord}
          className="mt-6 grid grid-cols-1 gap-3 rounded-md border border-dashed border-border/60 p-4 sm:grid-cols-5"
        >
          <input type="hidden" name="user_id" value={profile.id} />
          <div className="space-y-1">
            <Label htmlFor="month" className="text-xs">
              Mês
            </Label>
            <Input
              id="month"
              name="month"
              type="month"
              defaultValue={defaultMonth}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount" className="text-xs">
              Valor (€)
            </Label>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              placeholder="50"
              required
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="payment_notes" className="text-xs">
              Notas
            </Label>
            <Input id="payment_notes" name="notes" placeholder="opcional" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="status" className="text-xs">
              Estado
            </Label>
            <select
              id="status"
              name="status"
              defaultValue="paid"
              className={SELECT_CLASSES}
            >
              <option value="paid">Pago</option>
              <option value="unpaid">Por pagar</option>
              <option value="paused">Em pausa</option>
            </select>
          </div>
          <Button type="submit" size="sm" className="sm:col-span-5 sm:w-fit">
            Guardar pagamento
          </Button>
        </form>
      </section>
    </div>
  );
}
