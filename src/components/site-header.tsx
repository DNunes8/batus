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
  const horizontal = studio.brand.logo?.horizontal;
  const stacked = studio.brand.logo?.stacked;

  // Mobile uses the stacked variant — the Spartan B mark dominates so the
  // logo reads even at small sizes. Desktop uses the horizontal lockup so
  // the full "BATUS BOXING & TRAINING / ROBERT BALTARU" wordmark gets the
  // space it deserves.
  if (horizontal || stacked) {
    return (
      <span className="flex items-center transition-opacity hover:opacity-80">
        {stacked && (
          <Image
            src={stacked}
            alt={studio.fullName}
            width={400}
            height={400}
            priority
            quality={95}
            className="h-11 w-auto md:hidden"
          />
        )}
        {horizontal && (
          <Image
            src={horizontal}
            alt={studio.fullName}
            width={520}
            height={120}
            priority
            quality={95}
            className={`${stacked ? "hidden md:block" : ""} h-10 w-auto`}
          />
        )}
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
            className="inline-flex size-10 items-center justify-center rounded-md hover:bg-muted md:hidden"
          >
            <Menu className="size-6" />
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 overflow-y-auto p-0"
          >
            {/* Top: stacked logo. pr-14 leaves room for the built-in X close
                button (top-3 right-3) so it doesn't collide with the brand. */}
            <div className="px-6 pb-8 pt-8 pr-14">
              {studio.brand.logo?.stacked ? (
                <Image
                  src={studio.brand.logo.stacked}
                  alt={studio.fullName}
                  width={400}
                  height={400}
                  priority
                  className="h-16 w-auto"
                />
              ) : (
                <div>
                  <span className="font-display text-3xl tracking-[0.08em]">
                    {studio.name.toUpperCase()}
                  </span>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Boxing &amp; Training
                  </p>
                </div>
              )}
            </div>

            {/* Big editorial nav — large display type, numbered. Each row is
                its own border-separated tappable strip. */}
            <nav className="flex flex-col border-y border-border/40">
              {NAV.map((item, i) => (
                <SheetClose
                  key={item.href}
                  render={<Link href={item.href} />}
                  className="group flex items-baseline justify-between gap-4 border-b border-border/40 px-6 py-5 transition-colors last:border-b-0 hover:bg-muted/40 active:bg-muted/60"
                >
                  <span className="font-display text-3xl uppercase tracking-[0.04em] sm:text-4xl">
                    {item.label}
                  </span>
                  <span className="font-display text-xs tabular-nums text-muted-foreground transition-transform group-hover:translate-x-1">
                    {String(i + 1).padStart(2, "0")} →
                  </span>
                </SheetClose>
              ))}
            </nav>

            {/* Auth / user section */}
            <div className="px-6 py-6">
              {user ? (
                <MobileUserMenu user={user} />
              ) : (
                <SheetClose
                  render={<Link href="/login" />}
                  className="flex h-14 w-full items-center justify-center rounded-md bg-foreground text-base font-medium uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
                >
                  Entrar
                </SheetClose>
              )}
            </div>

            {/* Footer — Instagram link + location for personality */}
            <div className="mt-auto border-t border-border/40 px-6 py-5">
              {studio.social.instagram && (
                <a
                  href={`https://instagram.com/${studio.social.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                >
                  Instagram @{studio.social.instagram} →
                </a>
              )}
              <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                {studio.city} · {studio.country}
              </p>
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
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Sessão iniciada
        </p>
        <p className="mt-1 truncate text-sm font-medium">{user.email}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {user.is_admin && (
          <SheetClose
            render={<Link href="/admin" />}
            className="flex h-12 items-center justify-center rounded-md border border-foreground/60 text-sm font-medium uppercase tracking-[0.1em] text-foreground hover:bg-muted/40"
          >
            Admin
          </SheetClose>
        )}
        <SheetClose
          render={<Link href="/perfil" />}
          className={`flex h-12 items-center justify-center rounded-md border border-border/60 text-sm font-medium uppercase tracking-[0.1em] hover:bg-muted/40 ${
            user.is_admin ? "" : "col-span-2"
          }`}
        >
          Perfil
        </SheetClose>
      </div>
      <form action={signOut}>
        <Button
          type="submit"
          variant="outline"
          className="h-12 w-full text-sm uppercase tracking-[0.1em]"
        >
          Terminar sessão
        </Button>
      </form>
    </div>
  );
}
