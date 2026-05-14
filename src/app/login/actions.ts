"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

// Primary signup flow: email + password.
//
// We deliberately route through the admin API (`admin.auth.admin.createUser`
// with `email_confirm: true`) instead of `supabase.auth.signUp` so that the
// account is created already-confirmed — no email round-trip required, no
// dependency on whether the Supabase dashboard has "Confirm email" toggled
// on or off. Critical for non-tech students who'd be lost in their inbox.
//
// After creating, we sign in normally to get the session cookie.
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

  const admin = createAdminClient();
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists") ||
      msg.includes("duplicate")
    ) {
      return {
        error:
          "Já existe uma conta com este email. Volta a Entrar com a tua palavra-passe.",
      };
    }
    if (
      msg.includes("password") &&
      (msg.includes("short") || msg.includes("weak"))
    ) {
      return { error: "Palavra-passe demasiado curta — usa 6 ou mais." };
    }
    return { error: createError.message };
  }

  if (!created.user) {
    return { error: "Não foi possível criar a conta. Tenta novamente." };
  }

  // Create the session.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return {
      error:
        "Conta criada, mas não conseguimos iniciar sessão. Tenta Entrar com a tua palavra-passe.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/bem-vindo");
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

  // After verifying the OTP, route the user to /perfil?reset=1. That page
  // pops a banner and auto-scrolls them to the "Alterar palavra-passe"
  // section so the magic-link flow actually finishes with a password set.
  const next = encodeURIComponent("/perfil?reset=1");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${next}`,
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
