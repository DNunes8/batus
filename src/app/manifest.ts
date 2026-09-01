import type { MetadataRoute } from "next";
import { studio } from "@/lib/studio.config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: studio.fullName,
    short_name: studio.name,
    description: `${studio.fullName} — ${studio.tagline}`,
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf7",
    theme_color: "#0a0a0a",
    lang: "pt-PT",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
