import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth callback for Google sign-in (and any other future providers).
// Exchanges the ?code= for a session, then redirects to /admin or /aulas
// based on whether the user is admin.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (explicitNext) {
        return NextResponse.redirect(new URL(explicitNext, origin));
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();

        const dest = profile?.is_admin ? "/admin" : "/aulas";
        return NextResponse.redirect(new URL(dest, origin));
      }
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=oauth_failed", origin),
  );
}
