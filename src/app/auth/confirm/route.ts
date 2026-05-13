import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { todayLisbon } from "@/lib/schedule";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const explicitNext = searchParams.get("next");

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin, full_name, joined_at")
          .eq("id", user.id)
          .single();

        // First-time profile completion: brand-new account, still nameless.
        // Catch only fresh signups (joined today, Lisbon date) so a long-time
        // user who happens to be nameless doesn't get nagged on every login.
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

  return NextResponse.redirect(new URL("/login?error=expired", origin));
}
