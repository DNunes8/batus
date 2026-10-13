"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

// Every <Link> in the app goes through here, with prefetching switched off.
//
// Next.js prefetches each link as it scrolls into view. On Cloudflare every
// prefetch is a full server render — usually with a Supabase request — and
// each of those renders leaves memory behind in the Worker isolate. One visit
// to /aulas was triggering ~30 background renders (every class card and every
// header link, several of them twice), which is what filled isolates to the
// 128 MB limit and produced the 503s. Pages now load when they're clicked.
//
// This follows the "Disabled prefetch" pattern in Next's own prefetching guide.
// prefetch comes after the spread, so any value a caller passes is overridden.
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} prefetch={false} />;
}
