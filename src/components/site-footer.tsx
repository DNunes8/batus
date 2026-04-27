import Link from "next/link";
import { studio } from "@/lib/studio.config";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <p className="font-display text-xl tracking-[0.08em]">
              {studio.name.toUpperCase()}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Boxing &amp; Training
            </p>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Estúdio do treinador {studio.coach} em {studio.city},{" "}
              {studio.country}.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold">Estúdio</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/aulas" className="hover:text-foreground">
                  Aulas
                </Link>
              </li>
              <li>
                <Link href="/sobre" className="hover:text-foreground">
                  Sobre
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="hover:text-foreground">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold">Contacto</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{studio.contact.address}</li>
              <li>{studio.contact.email}</li>
              <li>{studio.contact.phone}</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {studio.fullName}. Todos os direitos
            reservados.
          </p>
          <p>
            <Link
              href={`https://instagram.com/${studio.social.instagram}`}
              className="hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              @{studio.social.instagram}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
