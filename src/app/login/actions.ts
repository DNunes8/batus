"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email")?.toString().trim().toLowerCase();

  if (!email) {
    return { status: "error", message: "Email obrigatório." };
  }

  const supabase = await createClient();

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return {
      status: "error",
      message: "Não foi possível enviar o email. Tenta novamente.",
    };
  }

  return { status: "sent", email };
}
