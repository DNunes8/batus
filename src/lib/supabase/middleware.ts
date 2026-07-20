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
  await getAuthUser(supabase);

  return supabaseResponse;
}
