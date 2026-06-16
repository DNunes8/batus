import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/email";

// Keep crawlers OFF the per-user / dynamic app routes. Those render through
// serverless functions, so letting bots crawl them is pure wasted usage — it
// was part of what blew the free-tier caps. The marketing pages (/, /sobre,
// /loja, /contacto, legal) stay indexable. This is defense-in-depth: it stops
// well-behaved bots; the real protection is those routes being static/ISR.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/admin", "/perfil", "/aulas", "/api", "/auth", "/bem-vindo"],
    },
    host: getSiteUrl(),
  };
}
