"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

async function originFromRequest(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email")?.toString().trim().toLowerCase();

  if (!email) {
    return { status: "error", message: "Email obrigatório." };
  }

  const supabase = await createClient();
  const origin = await originFromRequest();

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

// One-tap sign-in via Google. Requires the Google provider to be
// configured in Supabase (Authentication → Providers → Google) with
// matching redirect URL `<origin>/auth/callback`. See
// docs/GOOGLE_OAUTH_SETUP.md for the step-by-step.
export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = await originFromRequest();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect(
      `/login?error=${encodeURIComponent(
        error?.message ?? "Não foi possível iniciar sessão com o Google.",
      )}`,
    );
  }

  redirect(data.url);
}
