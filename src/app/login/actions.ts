"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  status?: "sent";
  email?: string;
} | null;

async function originFromRequest(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function destinationForUser(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return profile?.is_admin ? "/admin" : "/aulas";
}

// Primary login flow: email + password. Browsers offer to save the
// credentials on success; next visit autofills both fields.
export async function signInWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = ((formData.get("email") as string | null) ?? "")
    .trim()
    .toLowerCase();
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return { error: "Preenche email e palavra-passe." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "Email ou palavra-passe errados." };
  }

  revalidatePath("/", "layout");
  redirect(await destinationForUser(data.user.id));
}

// Primary signup flow: email + password. With "Confirm email" disabled in
// the Supabase dashboard, this creates a session immediately and the user
// goes straight to /bem-vindo to fill in their name.
export async function signUpWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = ((formData.get("email") as string | null) ?? "")
    .trim()
    .toLowerCase();
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return { error: "Preenche email e palavra-passe." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("user already")) {
      return {
        error:
          "Já existe uma conta com este email. Volta a Entrar com a tua palavra-passe.",
      };
    }
    if (msg.includes("password") && msg.includes("short")) {
      return { error: "Palavra-passe demasiado curta — usa 6 ou mais." };
    }
    return { error: error.message };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/bem-vindo");
  }

  // Fallback for the case where the admin hasn't disabled email confirmation
  // in the Supabase dashboard yet.
  return {
    error:
      "Verifica o teu email para confirmar a conta. (Confirma com o teu treinador se o email não chegar.)",
  };
}

// Fallback for the rare "forgot password" / "can't remember it" case.
// Sends a one-shot magic link the user can click to get back in, then
// optionally set a new password from /perfil.
export async function sendMagicLink(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = ((formData.get("email") as string | null) ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return { error: "Email obrigatório." };
  }

  const supabase = await createClient();
  const origin = await originFromRequest();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    return {
      error: "Não foi possível enviar o email. Tenta novamente.",
    };
  }

  return { status: "sent", email };
}

// Kept for future use (provider can be re-enabled). UI no longer surfaces it.
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
