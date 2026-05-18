"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { studio } from "@/lib/studio.config";

export function AdminMobileNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="flex items-center gap-2"
          aria-label={studio.fullName}
        >
          {studio.brand.logo?.stacked ? (
            <Image
              src={studio.brand.logo.stacked}
              alt={studio.fullName}
              width={400}
              height={400}
              priority
              className="h-10 w-auto"
            />
          ) : (
            <span className="font-display text-xl tracking-[0.08em]">
              BATUS
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-background">
            Admin
          </span>
        </Link>
        <Sheet>
          <SheetTrigger
            aria-label="Abrir menu admin"
            className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-6">
            <div className="flex h-full flex-col">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Admin
              </p>

              <nav className="mt-6 flex flex-col gap-1">
                {ADMIN_NAV.map((item) => (
                  <SheetClose
                    key={item.href}
                    render={<Link href={item.href} />}
                    className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </SheetClose>
                ))}
              </nav>

              <div className="mt-auto border-t border-border/60 pt-4">
                <SheetClose
                  render={<Link href="/" />}
                  className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  Ver site público →
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
