import Link from "next/link";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/aulas", label: "Aulas" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contacto", label: "Contacto" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-[0.08em] leading-none">
            {studio.name.toUpperCase()}
          </span>
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:inline">
            Boxing & Training
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Button
            render={<Link href="/login" />}
            nativeButton={false}
            size="sm"
            className="ml-2"
          >
            Entrar
          </Button>
        </nav>

        <Button
          render={<Link href="/login" />}
          nativeButton={false}
          size="sm"
          className="md:hidden"
        >
          Entrar
        </Button>
      </div>
    </header>
  );
}
