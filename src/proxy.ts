import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Only run the session-refresh proxy on routes that actually need a live
// session. Previously it matched every non-asset request — including the
// marketing pages and homepage — so each crawler hit triggered an Auth
// round-trip + an edge invocation (a big chunk of what paused us on Vercel).
// Marketing/public pages render fine without it (the header resolves auth on
// the client); per-user pages read the session directly and benefit from the
// token refresh here. `:path*` also matches the bare route (e.g. /aulas).
export const config = {
  matcher: [
    "/aulas/:path*",
    "/perfil/:path*",
    "/admin/:path*",
    "/bem-vindo/:path*",
    "/login",
    "/auth/:path*",
  ],
};
