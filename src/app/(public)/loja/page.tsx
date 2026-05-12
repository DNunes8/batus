import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/money";
import { claimItem } from "./actions";

export const dynamic = "force-dynamic";

export default async function LojaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from("merch_items")
    .select("*")
    .eq("is_active", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false });

  // Existing pending claims for this user, to show "Reservado" state.
  const myPending = user
    ? (
        await supabase
          .from("merch_claims")
          .select("item_id, quantity")
          .eq("user_id", user.id)
          .eq("status", "pending")
      ).data ?? []
    : [];

  const pendingByItem = new Map<string, number>();
  for (const c of myPending) {
    pendingByItem.set(
      c.item_id,
      (pendingByItem.get(c.item_id) ?? 0) + c.quantity,
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Loja
      </p>
      <h1 className="mt-6 font-display text-5xl tracking-[0.04em] sm:text-6xl">
        BATUS GEAR
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Reservas o artigo aqui e levantas no estúdio na próxima aula. Pagamento
        em pessoa.
      </p>

      {!items || items.length === 0 ? (
        <p className="mt-16 text-sm text-muted-foreground">
          Sem artigos disponíveis no momento.
        </p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const reservedByMe = pendingByItem.get(item.id) ?? 0;
            const lowStock = item.stock <= 3;
            return (
              <div
                key={item.id}
                className="flex flex-col rounded-md border border-border/60 p-5"
              >
                {item.image_url && (
                  // Using an unoptimised <img> here because URLs come from
                  // arbitrary external hosts (Instagram etc.) — adding them
                  // each to next.config.ts isn't worth it for MVP.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="mb-4 aspect-square w-full rounded-sm object-cover"
                  />
                )}
                <p className="font-display text-xl tracking-wider">
                  {item.name}
                </p>
                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="font-display text-2xl tabular-nums">
                    {formatEuro(item.price_cents)}
                  </span>
                  {lowStock && (
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      Restam {item.stock}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex-1" />

                {reservedByMe > 0 && (
                  <p className="mb-3 text-xs uppercase tracking-widest text-foreground">
                    Já reservaste {reservedByMe}
                  </p>
                )}

                {!user ? (
                  <Button
                    render={<Link href="/login?next=/loja" />}
                    nativeButton={false}
                    variant="outline"
                  >
                    Entrar para reservar
                  </Button>
                ) : (
                  <form action={claimItem}>
                    <input type="hidden" name="item_id" value={item.id} />
                    <Button type="submit" className="h-11 w-full text-base">
                      Reservar
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-16 text-xs text-muted-foreground">
        Quando reservas, o stock é guardado para ti. Se não levantares na
        próxima aula, o treinador pode cancelar a reserva.
      </p>
    </section>
  );
}
