import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";

// Defense-in-depth guard for admin server actions.
//
// Every admin action today uses the session client, and RLS already rejects
// non-admin writes — so the actions are secure as-is. But RLS is bypassed by
// the service-role client; any action that ever reaches for createAdminClient()
// would lose its only authorization check. Calling assertAdmin() at the top of
// every admin action makes the check explicit and uniform: a non-admin is
// redirected out instead of silently failing (or, in the admin-client case,
// silently succeeding).
//
// Cheap: one getUser() + one indexed lookup. Admin actions are not hot paths.
export async function assertAdmin(): Promise<void> {
  const supabase = await createClient();
  const { user, transient } = await getAuthUser(supabase);

  if (!user) {
    // A transient failure to reach Auth must not look like "logged out" — that
    // would boot the coach mid-action (e.g. marking a payment). Don't throw:
    // Next masks Server Action errors in prod, so an uncaught throw would
    // replace the whole admin UI with the generic error page. Redirect with a
    // toast param instead; the session stays intact so a retry just works.
    if (transient) {
      redirect("/admin?offline=1");
    }
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect("/?error=not_admin");
  }
}
