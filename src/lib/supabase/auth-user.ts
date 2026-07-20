import type { SupabaseClient, User } from "@supabase/supabase-js";

// Resilient wrapper around supabase.auth.getUser().
//
// getUser() is a live network call to Supabase Auth. On mobile — a backgrounded
// tab resuming, a flaky signal, or a brief free-tier throttle (429/5xx) — that
// call can fail transiently even though the user's session is perfectly valid.
// The old gates did `if (!user) redirect("/login")`, so a 1-second blip logged
// the coach out and made him retype his password. That was the "signed out every
// few minutes" bug: not an expired session, just a hiccup treated as a logout.
//
// This distinguishes the two cases:
//   • genuine "no session" / invalid token (400/401/403) → user is null,
//     transient is false → the caller SHOULD send them to /login.
//   • a retryable network/throttle error → we retry a couple of times (most
//     blips resolve in well under a second); if it still can't be confirmed we
//     return transient:true so the caller can show a soft "reconnecting" state
//     instead of nuking the session.
//
// Retries fire ONLY on a transient error, so a healthy request pays nothing —
// no polling, no extra load on the free tier. In fact it removes load, because a
// needless logout triggers a full re-login + page reload + data refetch.

function isTransientAuthError(error: unknown): boolean {
  if (!error) return false;
  const name = (error as { name?: string }).name ?? "";
  const status = (error as { status?: number }).status ?? 0;
  // GoTrue tags network failures / 5xx / 429 as AuthRetryableFetchError.
  if (name === "AuthRetryableFetchError") return true;
  // Belt-and-suspenders by HTTP status: 0 = fetch never got a response.
  if (status === 0 || status === 408 || status === 429) return true;
  if (status >= 500) return true;
  return false;
}

export type AuthUserResult = {
  user: User | null;
  // True only when we could NOT confirm auth due to a retryable error, even
  // after retries. Never true for a genuine "not logged in" — that is user:null
  // with transient:false. Callers must not treat transient:true as logged-out.
  transient: boolean;
};

export async function getAuthUser(
  supabase: SupabaseClient,
  retries = 2,
): Promise<AuthUserResult> {
  let sawTransient = false;

  for (let attempt = 0; ; attempt++) {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) return { user: data.user, transient: false };
      // A definitive answer (no session / invalid token): stop, let the caller
      // redirect to /login. Only keep retrying on retryable errors.
      if (!isTransientAuthError(error)) {
        return { user: null, transient: false };
      }
      sawTransient = true;
    } catch {
      // getUser normally returns errors rather than throwing, but a thrown
      // fetch failure is by definition transient — treat it as retryable.
      sawTransient = true;
    }

    if (attempt >= retries) return { user: null, transient: sawTransient };
    // Short linear backoff (150ms, 300ms). Only ever runs on a transient error.
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }
}
