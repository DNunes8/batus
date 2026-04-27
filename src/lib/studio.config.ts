// Single source of truth for studio branding and contact info.
// Swapping this file is the entry point for white-labeling later if ever needed.

export const studio = {
  name: "Batus",
  fullName: "Batus Boxing & Training",
  tagline: "Boxe e kickboxing em Braga",
  coach: "Robert Baltaru",
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

  // Monochrome system + single accent. Logo is pure black on white;
  // accent is gold (champion/laurel) — pending Diogo's confirmation between
  // gold and Portuguese red.
  brand: {
    background: "#FAFAF7", // warm off-white
    foreground: "#0A0A0A", // rich near-black
    accent: "#C9A227",     // champion gold (placeholder pending decision)
    // Optional asset paths (relative to /public). Set when files are saved.
    // Components fall back to typographic + plain backgrounds if nullish.
    logo_url: "/batus-logo.png" as string | null,
    hero_image_url: "/hero.jpg" as string | null,
    coach_image_url: "/coach.jpg" as string | null,
  },

  locale: {
    primary: "pt-PT",
    timezone: "Europe/Lisbon",
  },
} as const;

export type Studio = typeof studio;
