"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail, getSiteUrl } from "@/lib/email";

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
    .select("is_admin, full_name, phone, birthday")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.is_admin) return "/admin";
  // Non-admin with a missing name/phone/birthday — finish /bem-vindo first so
  // the coach never sees nameless rows in the Alunos list and the dashboard
  // birthday banner has every student dated.
  if (!profile?.full_name || !profile?.phone || !profile?.birthday) {
    return "/bem-vindo";
  }
  return "/aulas";
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
// Uses the standard supabase.auth.signUp — only the anon key, no service-role
// admin client. The studio runs Supabase with "Confirm email" turned OFF, so
// signUp returns a live session immediately and the new student lands logged
// in (no inbox round-trip — critical for non-tech users). If that setting were
// ever switched back on, signUp returns no session and we tell them to verify.
//
// (Previously this went through admin.auth.admin.createUser to force-confirm
// the account, but that needed SUPABASE_SERVICE_ROLE_KEY — a fragile extra
// dependency that broke signup whenever that env var was missing in prod.)
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
      (msg.includes("short") ||
        msg.includes("weak") ||
        msg.includes("least") ||
        msg.includes("6"))
    ) {
      return { error: "Palavra-passe demasiado curta — usa 6 ou mais." };
    }
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Não foi possível criar a conta. Tenta novamente." };
  }

  // Best-effort welcome email — nudges the new (pending) student to reach the
  // coach for approval. Never blocks signup (sendEmail swallows failures).
  await sendWelcomeEmail({ to: email, siteUrl: getSiteUrl() });

  // With "Confirm email" off, signUp returns a session and the cookie is set
  // — the user is logged in. If confirmation is on, there's no session.
  if (!data.session) {
    return {
      error:
        "Conta criada. Confirma o email que te enviámos para poderes entrar.",
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
