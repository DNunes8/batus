// Guards against open-redirect abuse on `next` / redirect parameters.
//
// A `next` value that comes from the URL or a form field must never be
// trusted as a redirect target — `new URL(next, origin)` happily accepts an
// absolute URL ("https://evil.com") or a protocol-relative one ("//evil.com")
// and sends the user off-site. Only same-site relative paths are allowed.

export function safeRelativePath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  // Must be an absolute path on our own site.
  if (!value.startsWith("/")) return null;

  // Reject protocol-relative ("//host") and backslash tricks ("/\\host")
  // that browsers can interpret as an off-site URL.
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  return value;
}
