// Single source of truth for studio branding and contact info.
// Swapping this file is the entry point for white-labeling later if ever needed.

export const studio = {
  name: "Batus",
  fullName: "Batus Studio",
  tagline: "Boxe e kickboxing em Braga",
  city: "Braga",
  country: "Portugal",

  contact: {
    email: "TBD",
    phone: "TBD",
    address: "TBD, Braga, Portugal",
  },

  social: {
    instagram: "TBD",
    facebook: "TBD",
  },

  brand: {
    primary: "#000000",
    accent: "#dc2626",
  },

  locale: {
    primary: "pt-PT",
    timezone: "Europe/Lisbon",
  },
} as const;

export type Studio = typeof studio;
