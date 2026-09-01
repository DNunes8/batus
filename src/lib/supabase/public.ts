import { createClient } from "@supabase/supabase-js";

// Cookie-free Supabase client for PUBLIC data reads (anon key, RLS still
// applies). Because it never touches cookies/headers, pages that use it can be
// statically generated / ISR-cached instead of being forced dynamic — which is
// what keeps crawler traffic off our serverless function budget. Use ONLY for
// data that is the same for everyone (e.g. the public class schedule, shop
// items). For anything per-user, use the cookie-aware server client.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
