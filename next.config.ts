import type { NextConfig } from "next";

// Baseline security headers applied to every response. A full
// Content-Security-Policy is deliberately left out for now — it needs
// careful per-route testing against Next's inline scripts, Supabase, and
// the testimonial video — but X-Frame-Options already covers the main
// clickjacking concern that CSP frame-ancestors would.
const securityHeaders = [
  // Stop browsers MIME-sniffing a response into an unexpected type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow the site being framed elsewhere (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Don't leak full URLs (with query params) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses none of these device features — turn them off.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
