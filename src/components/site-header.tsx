"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { studio } from "@/lib/studio.config";
import { createClient } from "@/lib/supabase/client";
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

// Auth state is read on the CLIENT so the public layout/pages no longer touch
// the session server-side — that's what lets them be statically cached (and
// keeps crawler traffic off our function budget). A brief logged-out flash on
// first paint is expected; it resolves once the check returns and updates live
// on login/logout. The real access gates live server-side, so this is display
// only — never a security boundary.
function useCurrentUser(): HeaderUser {
  const [user, setUser] = useState<HeaderUser>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) {
        if (active) setUser(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", u.id)
        .single();
      if (active) {
        setUser({
          email: u.email ?? "",
          is_admin: profile?.is_admin ?? false,
        });
      }
    }

    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return user;
}

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
            width={640}
            height={640}
            priority
            quality={95}
            className={`${stacked ? "hidden md:block" : ""} h-14 w-auto`}
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

export function SiteHeader() {
  const user = useCurrentUser();
  // Logged-in users are already inside the app — hide the marketing
  // "Sobre" page from the nav so it doesn't feel out of place.
  const navItems = user ? NAV.filter((item) => item.href !== "/sobre") : NAV;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 md:h-20">
        <Link href="/" aria-label={studio.fullName}>
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <span aria-hidden className="h-5 w-px bg-border" />
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

            {/* Editorial nav — big enough to feel deliberate, quiet enough
                not to shout. Display serif at text-xl, border-separated rows,
                generous tap target via py-4. */}
            <nav className="flex flex-col border-y border-border/40">
              {navItems.map((item) => (
                <SheetClose
                  key={item.href}
                  render={<Link href={item.href} />}
                  nativeButton={false}
                  className="border-b border-border/40 px-6 py-4 font-display text-xl uppercase tracking-[0.04em] transition-colors last:border-b-0 hover:bg-muted/40 active:bg-muted/60"
                >
                  {item.label}
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
                  nativeButton={false}
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
    <Button render={<Link href="/login" />} nativeButton={false} size="sm">
      Entrar
    </Button>
  );
}

function DesktopUserMenu({ user }: { user: NonNullable<HeaderUser> }) {
  return (
    <div className="flex items-center gap-6">
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
            nativeButton={false}
            className="flex h-12 items-center justify-center rounded-md border border-foreground/60 text-sm font-medium uppercase tracking-[0.1em] text-foreground hover:bg-muted/40"
          >
            Admin
          </SheetClose>
        )}
        <SheetClose
          render={<Link href="/perfil" />}
          nativeButton={false}
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
