"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOut } from "@/app/auth/actions";

const NAV = [
  { href: "/aulas", label: "Aulas" },
  { href: "/loja", label: "Loja" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contacto", label: "Contacto" },
] as const;

export type HeaderUser = {
  email: string;
  is_admin: boolean;
} | null;

function Wordmark() {
  if (studio.brand.logo_url) {
    return (
      <span className="flex items-center gap-3">
        <Image
          src={studio.brand.logo_url}
          alt={studio.fullName}
          width={56}
          height={56}
          quality={95}
          className="-my-3 shrink-0"
        />
        <span className="hidden font-display text-2xl tracking-[0.08em] leading-none sm:inline">
          {studio.name.toUpperCase()}
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-display text-2xl tracking-[0.08em] leading-none">
        {studio.name.toUpperCase()}
      </span>
      <span className="hidden text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:inline">
        Boxing &amp; Training
      </span>
    </span>
  );
}

export function SiteHeader({ user }: { user: HeaderUser }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label={studio.fullName}>
          <Wordmark />
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
          {user ? <DesktopUserMenu user={user} /> : <DesktopLoginButton />}
        </nav>

        <Sheet>
          <SheetTrigger
            aria-label="Abrir menu"
            className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted md:hidden"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-6">
            <div className="flex h-full flex-col">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl tracking-[0.08em]">
                  {studio.name.toUpperCase()}
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Menu
                </span>
              </div>

              <nav className="mt-10 flex flex-col gap-1">
                {NAV.map((item) => (
                  <SheetClose
                    key={item.href}
                    render={<Link href={item.href} />}
                    className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </SheetClose>
                ))}
              </nav>

              <div className="mt-auto border-t border-border/60 pt-4">
                {user ? (
                  <MobileUserMenu user={user} />
                ) : (
                  <SheetClose
                    render={<Link href="/login" />}
                    className="block rounded-md bg-foreground px-3 py-2 text-center text-sm font-medium text-background"
                  >
                    Entrar
                  </SheetClose>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function DesktopLoginButton() {
  return (
    <Button
      render={<Link href="/login" />}
      nativeButton={false}
      size="sm"
      className="ml-2"
    >
      Entrar
    </Button>
  );
}

function DesktopUserMenu({ user }: { user: NonNullable<HeaderUser> }) {
  return (
    <div className="ml-2 flex items-center gap-2">
      {user.is_admin && (
        <Link
          href="/admin"
          className="text-sm font-medium text-foreground/80 hover:text-foreground"
        >
          Admin
        </Link>
      )}
      <Link
        href="/perfil"
        className="text-sm font-medium text-foreground/80 hover:text-foreground"
      >
        Perfil
      </Link>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          Sair
        </Button>
      </form>
    </div>
  );
}

function MobileUserMenu({ user }: { user: NonNullable<HeaderUser> }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Sessão
      </p>
      <p className="truncate text-sm">{user.email}</p>
      <div className="flex flex-col gap-1 pt-2">
        {user.is_admin && (
          <SheetClose
            render={<Link href="/admin" />}
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
          >
            Admin
          </SheetClose>
        )}
        <SheetClose
          render={<Link href="/perfil" />}
          className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
        >
          Perfil
        </SheetClose>
        <form action={signOut}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="mt-1 w-full"
          >
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
