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

// "Forgot password" flow. Uses Supabase's dedicated recovery flow (not
// signInWithOtp / magic link) because:
//   1. Magic-link emails go through Supabase's /auth/v1/verify endpoint which
//      delivers the session in a URL hash fragment — invisible to the server,
//      so our /auth/confirm route can't read it and the SSR session never
//      gets set on our domain. Admin users then bounce to /admin via the
//      already-authenticated cookie, never reaching /perfil to set a password.
//   2. resetPasswordForEmail produces a `type=recovery` URL that lands on
//      /auth/confirm directly with a `token_hash` query param. Our route
//      verifyOtp's it server-side, gets a real session cookie, then forces
//      /perfil?reset=1 (hardcoded in /auth/confirm — does NOT rely on the
//      email template carrying a `next` param).
export async function sendPasswordReset(
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

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // The recovery email's link routes here. /auth/confirm sees type=recovery
    // and forces /perfil?reset=1, so the destination is encoded in our code,
    // not in the email template.
    redirectTo: `${origin}/auth/confirm`,
  });

  if (error) {
    return {
      error: "Não foi possível enviar o email. Tenta novamente.",
    };
  }

  return { status: "sent", email };
}

// Back-compat alias: anything still importing the old name keeps working.
// Remove once we've migrated all callers.
export const sendMagicLink = sendPasswordReset;

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
