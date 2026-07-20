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
  // Expected booking/cancel failures. Server actions redirect with these
  // instead of throwing — Next masks thrown messages in production, so a
  // throw would show the generic error page instead of the real reason.
  oneperday: {
    type: "error",
    message: "Só podes marcar uma aula por dia.",
    description: "Cancela a outra marcação primeiro, em Perfil.",
    action: { label: "Perfil", href: "/perfil" },
  },
  already: {
    type: "info",
    message: "Já tens marcação para esta aula.",
  },
  weeklylimit: {
    type: "error",
    message: "Atingiste o limite de aulas desta semana.",
    description:
      "O teu plano renova à segunda-feira. Para mais aulas, fala com o treinador.",
  },
  cutoff: {
    type: "error",
    message: "Já não dá para cancelar esta aula.",
    description: "O limite de cancelamento passou — fala com o treinador.",
  },
  expired: {
    type: "error",
    message: "Esse link expirou ou já foi usado.",
    description: "Pede um novo em “Esqueci-me da palavra-passe”.",
  },
  // Transient failure to reach Supabase Auth (network blip / free-tier
  // throttle). The gate bounces here with the session intact instead of
  // logging the user out — a retry just works.
  offline: {
    type: "error",
    message: "Sem ligação ao servidor.",
    description: "A tua sessão continua ativa. Tenta outra vez.",
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
