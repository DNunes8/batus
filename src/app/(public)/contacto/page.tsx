import { studio } from "@/lib/studio.config";

export default function ContactoPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-32">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Contacto
      </p>
      <h1 className="mt-6 font-display text-5xl tracking-[0.04em] sm:text-6xl">
        FALA CONNOSCO
      </h1>

      <dl className="mt-12 grid gap-8 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Estúdio
          </dt>
          <dd className="mt-2 text-base">{studio.contact.address}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Email
          </dt>
          <dd className="mt-2 text-base">{studio.contact.email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Telefone
          </dt>
          <dd className="mt-2 text-base">{studio.contact.phone}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Instagram
          </dt>
          <dd className="mt-2 text-base">@{studio.social.instagram}</dd>
        </div>
      </dl>

      <p className="mt-20 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Formulário de contacto em breve
      </p>
    </section>
  );
}
