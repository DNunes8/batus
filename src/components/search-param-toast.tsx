"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Generic helper: server actions can redirect with ?<key>=1 and this
// component fires the matching toast on the next render, then strips
// the param from the URL so a refresh doesn't re-trigger.

type ToastConfig = {
  type: "success" | "error" | "info";
  message: string;
  description?: string;
  action?: { label: string; href: string };
};

const TOAST_BY_PARAM: Record<string, ToastConfig> = {
  saved: { type: "success", message: "Guardado." },
  sent: { type: "success", message: "Mensagem enviada." },
  booked: {
    type: "success",
    message: "Aula marcada.",
    description: "Vês e cancelas em Perfil.",
    action: { label: "Perfil", href: "/perfil" },
  },
  waitlist: {
    type: "info",
    message: "Estás em lista de espera.",
    description: "Avisamos-te quando houver vaga.",
  },
  cancelled: {
    type: "success",
    message: "Marcação cancelada.",
  },
  welcome: {
    type: "success",
    message: "Bem-vindo ao Batus!",
    description: "Marca a tua primeira aula em baixo.",
  },
  password: {
    type: "success",
    message: "Palavra-passe alterada.",
    description: "Da próxima vez, usa a nova para entrares.",
  },
};

export function SearchParamToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    for (const [key, config] of Object.entries(TOAST_BY_PARAM)) {
      if (params.get(key) === "1") {
        const action = config.action;
        toast[config.type](config.message, {
          description: config.description,
          action: action
            ? {
                label: action.label,
                onClick: () => router.push(action.href),
              }
            : undefined,
        });
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
