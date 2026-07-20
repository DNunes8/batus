import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { AdminMobileNav } from "@/components/admin-mobile-nav";
import { Reconnecting } from "@/components/reconnecting";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { studio } from "@/lib/studio.config";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { user, transient } = await getAuthUser(supabase);

  if (!user) {
    // Couldn't reach Auth to confirm the session — show a soft reconnect screen
    // rather than logging a valid user out and forcing a password re-entry.
    if (transient) return <Reconnecting />;
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/?error=not_admin");
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-56 shrink-0 border-r border-border/60 bg-muted/30 px-4 py-6 lg:block">
        <Link
          href="/admin"
          className="block transition-opacity hover:opacity-80"
          aria-label={studio.fullName}
        >
          {studio.brand.logo?.stacked ? (
            <Image
              src={studio.brand.logo.stacked}
              alt={studio.fullName}
              width={400}
              height={400}
              priority
              className="h-24 w-auto"
            />
          ) : (
            <span className="font-display text-2xl tracking-[0.08em]">
              BATUS
            </span>
          )}
          <span className="mt-3 flex w-fit items-center rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-background">
            Admin
          </span>
        </Link>
        <nav className="mt-10 flex flex-col gap-1">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-10 border-t border-border/60 pt-4">
          <Link
            href="/"
            className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Ver site público →
          </Link>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <AdminMobileNav />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
