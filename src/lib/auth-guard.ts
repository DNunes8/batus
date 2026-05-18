import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
