"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Generic helper: server actions can redirect with ?<key>=1 and this
// component fires the matching toast on the next render, then strips
// the param from the URL so a refresh doesn't re-trigger.
const TOAST_BY_PARAM: Record<
  string,
  { type: "success" | "error" | "info"; message: string }
> = {
  saved: { type: "success", message: "Guardado." },
  sent: { type: "success", message: "Mensagem enviada." },
};

export function SearchParamToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    for (const [key, config] of Object.entries(TOAST_BY_PARAM)) {
      if (params.get(key) === "1") {
        toast[config.type](config.message);
        const next = new URLSearchParams(params);
        next.delete(key);
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        break;
      }
    }
  }, [params, router, pathname]);

  return null;
}
