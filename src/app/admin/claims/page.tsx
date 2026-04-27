import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/money";
import { cancelClaim, fulfillClaim } from "./actions";

export const dynamic = "force-dynamic";

type Status = "pending" | "fulfilled" | "cancelled";

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendentes",
  fulfilled: "Entregues",
  cancelled: "Cancelados",
};

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status: Status = (["pending", "fulfilled", "cancelled"].includes(
    params.status ?? "",
  )
    ? params.status
    : "pending") as Status;

  const supabase = await createClient();
  const { data: claims } = await supabase
    .from("merch_claims")
    .select(
      `id, quantity, status, claimed_at, fulfilled_at, notes,
       item:merch_items(name, price_cents),
       profile:profiles(full_name, email)`,
    )
    .eq("status", status)
    .order("claimed_at", { ascending: false });

  return (
    <div className="p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Loja
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        PEDIDOS
      </h1>

      <div className="mt-6 flex gap-2">
        {(["pending", "fulfilled", "cancelled"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/claims?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              status === s
                ? "bg-foreground text-background"
                : "text-foreground/70 hover:bg-muted"
            }`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {!claims || claims.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Sem pedidos {STATUS_LABEL[status].toLowerCase()}.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Aluno</th>
                <th className="px-4 py-3 font-medium">Artigo</th>
                <th className="px-4 py-3 font-medium">Qt</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {claims.map((c) => {
                const profile = c.profile as unknown as {
                  full_name: string | null;
                  email: string;
                };
                const item = c.item as unknown as {
                  name: string;
                  price_cents: number;
                };
                const when = new Date(c.claimed_at).toLocaleString("pt-PT", {
                  dateStyle: "short",
                  timeStyle: "short",
                });
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {profile?.full_name || profile?.email || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">{item?.name}</td>
                    <td className="px-4 py-3 tabular-nums">{c.quantity}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatEuro((item?.price_cents ?? 0) * c.quantity)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {when}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <form action={fulfillClaim}>
                            <input type="hidden" name="id" value={c.id} />
                            <Button type="submit" size="sm">
                              Entregue
                            </Button>
                          </form>
                          <form action={cancelClaim}>
                            <input type="hidden" name="id" value={c.id} />
                            <Button
                              type="submit"
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                            >
                              Cancelar
                            </Button>
                          </form>
                        </div>
                      )}
                      {status === "fulfilled" && c.fulfilled_at && (
                        <span className="text-xs text-muted-foreground">
                          em{" "}
                          {new Date(c.fulfilled_at).toLocaleDateString("pt-PT")}
                        </span>
                      )}
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
