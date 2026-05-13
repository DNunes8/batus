import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayLisbon } from "@/lib/schedule";

// OAuth callback for Google sign-in (and any future providers).
// Exchanges the ?code= for a session, prefills the profile name from
// the provider's metadata if available, then routes the user.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // OAuth providers usually supply the user's full name in metadata.
        // Prefill the profile so Google users skip /bem-vindo entirely.
        const providerName =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined);

        if (providerName) {
          await supabase
            .from("profiles")
            .update({ full_name: providerName })
            .eq("id", user.id)
            .is("full_name", null);
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin, full_name, joined_at")
          .eq("id", user.id)
          .single();

        // Same first-time check as /auth/confirm — only fires for genuine
        // new accounts that landed here without a name (e.g. unusual OAuth
        // provider that doesn't return name metadata).
        if (
          profile &&
          !profile.full_name &&
          typeof profile.joined_at === "string" &&
          profile.joined_at.slice(0, 10) === todayLisbon()
        ) {
          const onboardingUrl = explicitNext
            ? `/bem-vindo?next=${encodeURIComponent(explicitNext)}`
            : "/bem-vindo";
          return NextResponse.redirect(new URL(onboardingUrl, origin));
        }

        if (explicitNext) {
          return NextResponse.redirect(new URL(explicitNext, origin));
        }

        const dest = profile?.is_admin ? "/admin" : "/aulas";
        return NextResponse.redirect(new URL(dest, origin));
      }
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=oauth_failed", origin),
  );
}
