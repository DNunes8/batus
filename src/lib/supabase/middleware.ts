import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth-user";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touching getUser() refreshes the auth cookie when needed. Here — unlike a
  // Server Component — setAll actually writes cookies onto supabaseResponse, so
  // this is the ONE place a rotated refresh token gets persisted. Retrying on a
  // transient error matters: if this refresh silently fails, a later gate's
  // getUser() could trigger a rotation it can't persist, invalidating the token
  // for the next request. getAuthUser retries only on retryable errors.
  const { user, transient } = await getAuthUser(supabase);

  // Hard edge gate for the private areas. This must happen HERE, before any
  // rendering: App Router layouts and pages render CONCURRENTLY, so a
  // redirect() inside the admin layout does not stop the page from fetching —
  // on a streaming runtime, fragments of real data can end up in the response
  // body an anonymous client receives (a 200 + meta-refresh, not a true 307).
  // Bouncing anonymous requests at the edge closes that entirely.
  // Fail-open on transient: if Auth is unreachable we can't tell "logged out"
  // from "blip" — let the request through and the pages' own soft-reconnect
  // handling deals with it, instead of kicking a valid coach to /login.
  const path = request.nextUrl.pathname;
  const isPrivate = path.startsWith("/admin") || path.startsWith("/perfil");
  if (isPrivate && !user && !transient) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
