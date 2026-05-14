"use client";

import { useEffect } from "react";

// Smoothly scrolls to a target element shortly after mount. Used on
// /perfil?reset=1 so users coming from the "forgot password" magic link
// land directly on the password-change form instead of having to hunt
// for it.
export function AutoScrollTo({ targetId }: { targetId: string }) {
  useEffect(() => {
    const handle = setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 120);
    return () => clearTimeout(handle);
  }, [targetId]);
  return null;
}
