import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// No session read here on purpose. The header now resolves auth on the client,
// so this layout stays static — which lets the marketing pages it wraps be
// cached instead of rendered per request (the fix for the Vercel usage that
// paused us). Per-user pages (/aulas, /perfil, /admin) read the session
// themselves and remain dynamic.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
