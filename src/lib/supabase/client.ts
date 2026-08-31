import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Static reads so Next inlines them into the bundle; a helper with a computed
  // key would leave the browser holding undefined.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY were not set when this was built. See .env.example.",
    );
  }
  return createBrowserClient(url, anonKey);
}
