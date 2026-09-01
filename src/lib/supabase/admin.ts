import { createClient } from "@supabase/supabase-js";

// Server-only client that bypasses RLS via the service role key.
// Use sparingly — only when we explicitly need to read/write data the
// caller's session can't. NEVER import this into a client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
