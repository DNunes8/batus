import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/money";
import { ConfirmForm } from "@/components/confirm-form";
import { deleteMerchItem, toggleMerchActive } from "./actions";

export const dynamic = "force-dynamic";

export default async function MerchPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("merch_items")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 sm:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Loja
          </p>
          <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
            ARTIGOS
          </h1>
        </div>
        <Button render={<Link href="/admin/merch/new" />} nativeButton={false}>
          Novo artigo
        </Button>
      </div>

      {!items || items.length === 0 ? (
        <div className="mt-12 rounded-md border border-dashed border-border/60 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Sem artigos na loja.
          </p>
          <Button
            render={<Link href="/admin/merch/new" />}
            nativeButton={false}
            className="mt-6"
          >
            Novo artigo
          </Button>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-md border p-4 ${
                item.is_active
                  ? "border-border/60"
                  : "border-border/40 bg-muted/30 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{item.name}</p>
                {!item.is_active && (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Inativo
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
              )}
              <div className="mt-3 flex items-baseline justify-between text-sm">
                <span className="font-display tabular-nums">
                  {formatEuro(item.price_cents)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Stock: {item.stock}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <form action={toggleMerchActive}>
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    type="hidden"
                    name="next"
                    value={item.is_active ? "false" : "true"}
                  />
                  <Button type="submit" variant="outline" size="sm">
                    {item.is_active ? "Desativar" : "Ativar"}
                  </Button>
                </form>
                <ConfirmForm
                  message={`Apagar "${item.name}" para sempre? Não dá para desfazer.`}
                  action={deleteMerchItem}
                >
                  <input type="hidden" name="id" value={item.id} />
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
            </div>
          ))}
        </div>
      )}

      <p className="mt-12 text-xs text-muted-foreground">
        Os artigos só aparecem na loja pública se estiverem ativos e tiverem
        stock &gt; 0.
      </p>
    </div>
  );
}
