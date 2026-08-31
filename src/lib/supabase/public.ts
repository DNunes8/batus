import { createClient } from "@supabase/supabase-js";

// Cookie-free Supabase client for PUBLIC data reads (anon key, RLS still
// applies). Because it never touches cookies/headers, pages that use it can be
// statically generated / ISR-cached instead of being forced dynamic — which is
// what keeps crawler traffic off our serverless function budget. Use ONLY for
// data that is the same for everyone (e.g. the public class schedule, shop
// items). For anything per-user, use the cookie-aware server client.
export function createPublicClient() {
  // Read statically so Next can inline them, then say which one is missing —
  // the library's own error is "supabaseUrl is required.", which tells a fresh
  // clone nothing about what to put where. See .env.example.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set at BUILD time — they are compiled into the browser bundle. See .env.example.",
    );
  }

  return createClient(url, anonKey, { auth: { persistSession: false } });
}
