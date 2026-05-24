// Single source of truth for studio branding and contact info.
// Swapping this file is the entry point for white-labeling later if ever needed.

export const studio = {
  name: "Batus",
  fullName: "Batus Boxing & Training",
  tagline: "Boxe e kickboxing em Braga",
  coach: "Baltaru",
  city: "Braga",
  country: "Portugal",

  contact: {
    email: "TBD",
    phone: "TBD",
    address: "TBD, Braga, Portugal",
  },

  social: {
    instagram: "batusboxing",
    facebook: "TBD",
  },

  // Legal identification used by the Termos and Privacidade pages.
  // `controller` / `taxId` / `registeredAddress` are filled in at hand-off.
  // Until then `configured()` returns null and the Privacidade page shows the
  // studio name plus a note that the full legal identification is pending.
  legal: {
    // Data controller: Baltaru's legal name, or the company name if Batus
    // is incorporated — e.g. "Robert Baltaru" or "Batus Unipessoal, Lda."
    controller: "TBD",
    // NIF (sole trader) or NIPC (company) of the controller above.
    taxId: "TBD",
    // Registered address of the controller, if different from the studio.
    registeredAddress: "TBD",
    // Date the legal pages were last reviewed — shown as "Última atualização".
    // Update this whenever you edit the Termos or Privacidade text.
    lastUpdated: "18 de maio de 2026",
  },

  // Monochrome system + single accent. Logo is pure black on white;
  // accent is gold (champion/laurel) — pending Diogo's confirmation between
  // gold and Portuguese red.
  brand: {
    background: "#FAFAF7", // warm off-white
    foreground: "#0A0A0A", // rich near-black
    accent: "#C9A227",     // champion gold (placeholder pending decision)
    // Optional asset paths (relative to /public). Set when files are saved.
    // Components fall back to typographic + plain backgrounds if nullish.
    logo: {
      // Wide horizontal lockup: Spartan B + "BATUS BOXING & TRAINING /
      // ROBERT BALTARU" in one line. Best for headers, footers, and dark
      // CTA bands (with `invert`).
      horizontal: "/logo-horizontal.png" as string | null,
      // Stacked: prominent Spartan B mark above the wordmark. Best for
      // splash/loading, /login, /bem-vindo, large standalone uses.
      stacked: "/logo-stacked.png" as string | null,
    },
    // Legacy single-file alias — points at the stacked file for any
    // older callers. Prefer logo.horizontal / logo.stacked going forward.
    logo_url: "/logo-stacked.png" as string | null,
    hero_image_url: "/hero.png" as string | null,
    coach_image_url: "/coach.png" as string | null,
    // Sobre-page media — empty until real assets exist. The matching
    // gallery / video sections on /sobre render only once these are
    // populated, so the page always looks complete. Add /public paths
    // here when Baltaru's photos and intro video arrive.
    about_gallery: [] as string[],
    about_video_url: null as string | null,
  },

  locale: {
    primary: "pt-PT",
    timezone: "Europe/Lisbon",
  },
} as const;

export type Studio = typeof studio;

// Returns the value only if it's a real, configured value — null when it's
// still a "TBD" placeholder. Lets the UI hide unset contact details instead
// of rendering "TBD" to visitors before Baltaru hands over the real info.
export function configured(value: string | null | undefined): string | null {
  if (!value) return null;
  return /\bTBD\b/i.test(value) ? null : value;
}
