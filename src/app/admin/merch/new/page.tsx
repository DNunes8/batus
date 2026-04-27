import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMerchItem } from "../actions";

export default function NewMerchPage() {
  return (
    <div className="max-w-2xl p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Loja
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        NOVO ARTIGO
      </h1>

      <form action={createMerchItem} className="mt-10 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            name="name"
            required
            autoFocus
            placeholder="ex: T-shirt Batus"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            placeholder="ex: T-shirt 100% algodão, várias cores"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Preço (€)</Label>
            <Input
              id="price"
              name="price"
              required
              placeholder="ex: 20"
              defaultValue="20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stock">Stock disponível</Label>
            <Input
              id="stock"
              name="stock"
              type="number"
              min={0}
              max={1000}
              defaultValue={10}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="image_url">URL da imagem (opcional)</Label>
          <Input
            id="image_url"
            name="image_url"
            type="url"
            placeholder="https://..."
          />
          <p className="text-xs text-muted-foreground">
            Cola um link de uma imagem (Instagram, Imgur, etc.). Suporte a
            upload chega depois.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit">Criar artigo</Button>
          <Link
            href="/admin/merch"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
