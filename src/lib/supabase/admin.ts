import { createClient } from "@supabase/supabase-js";

// Server-only client that bypasses RLS via the service role key.
// Use sparingly — only when we explicitly need to read/write data the
// caller's session can't. NEVER import this into a client component.

// Missing config used to sail through the `!` and produce a client that failed
// on every call with an opaque error — a deploy from a machine without the key
// looked healthy until a coach opened the calendar. Say which variable is
// missing, once, at the first use.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. On Cloudflare it comes from \`wrangler secret\`; locally from .env.local (see .env.example).`,
    );
  }
  return value;
}

export function createAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
