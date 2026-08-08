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
// Page variant of the guard below. Every admin PAGE must call this before its
// first data fetch: App Router renders layouts and pages CONCURRENTLY, so the
// layout's redirect does not stop a page from fetching — on a streaming
// runtime, fetched data can leak into the response body before the redirect
// applies. The middleware already bounces anonymous requests at the edge; this
// closes the remaining vector (an authenticated NON-admin hitting an admin
// URL) right where the data lives.
//
// Differences from assertAdmin (the actions guard): on a transient auth
// failure this returns instead of redirecting — the admin layout renders
// <Reconnecting/> in that case (discarding page output), and redirecting to
// /admin?offline=1 from a PAGE would loop while Auth is down.
export async function assertAdminPage(): Promise<void> {
  const supabase = await createClient();
  const { user, transient } = await getAuthUser(supabase);

  if (transient) return;
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect("/?error=not_admin");
  }
}

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
