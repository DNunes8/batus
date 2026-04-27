import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEuro, formatMonthYear } from "@/lib/money";
import {
  togglePaymentStatus,
  updateStudentNotesAndGoals,
  upsertPaymentRecord,
} from "./actions";

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

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Perfil
        </h2>
        <form
          action={updateStudentNotesAndGoals}
          className="mt-4 space-y-4 rounded-md border border-border/60 p-4"
        >
          <input type="hidden" name="id" value={profile.id} />
          <div className="grid grid-cols-2 gap-4">
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
          <Button type="submit" size="sm">
            Guardar
          </Button>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Pagamentos
        </h2>

        {payments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Sem registos de pagamento.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-md border border-border/60">
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
                  const isPaid = !!p.paid_at;
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2 font-medium">
                        {formatMonthYear(p.month)}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {formatEuro(p.amount_cents)}
                      </td>
                      <td className="px-4 py-2">
                        {isPaid ? (
                          <span className="text-foreground">
                            Pago em{" "}
                            {new Date(p.paid_at!).toLocaleDateString("pt-PT")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Por pagar
                          </span>
                        )}
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
                            name="currently_paid"
                            value={isPaid ? "true" : "false"}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {isPaid ? "Marcar por pagar" : "Marcar pago"}
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
            <Input id="amount" name="amount" placeholder="50" required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="payment_notes" className="text-xs">
              Notas
            </Label>
            <Input id="payment_notes" name="notes" placeholder="opcional" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pago?</Label>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" name="paid" />
              <span>Sim</span>
            </label>
          </div>
          <Button type="submit" size="sm" className="sm:col-span-5 sm:w-fit">
            Guardar pagamento
          </Button>
        </form>
      </section>
    </div>
  );
}
