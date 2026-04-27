import Link from "next/link";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContactMessage } from "./actions";

export default async function ContactoPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const errorKey = params.error;

  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Contacto
      </p>
      <h1 className="mt-6 font-display text-5xl tracking-[0.04em] sm:text-6xl">
        FALA CONNOSCO
      </h1>

      <div className="mt-12 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Estúdio
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Morada
              </dt>
              <dd className="mt-1">{studio.contact.address}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1">{studio.contact.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Telefone
              </dt>
              <dd className="mt-1">{studio.contact.phone}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Instagram
              </dt>
              <dd className="mt-1">
                <Link
                  href={`https://instagram.com/${studio.social.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  @{studio.social.instagram}
                </Link>
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Envia mensagem
          </h2>

          {sent ? (
            <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-6">
              <p className="font-display text-2xl tracking-wider">OBRIGADO</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Recebemos a tua mensagem. Vamos responder em breve.
              </p>
              <Link
                href="/contacto"
                className="mt-4 inline-block text-sm hover:underline"
              >
                Enviar outra
              </Link>
            </div>
          ) : (
            <form action={submitContactMessage} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (opcional)</Label>
                <Input id="phone" name="phone" type="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  placeholder="Conta-nos o que procuras"
                />
              </div>

              {errorKey && (
                <p className="text-sm text-destructive">
                  {errorKey === "missing"
                    ? "Preenche todos os campos obrigatórios."
                    : "Não conseguimos enviar a mensagem. Tenta de novo."}
                </p>
              )}

              <Button type="submit">Enviar</Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
