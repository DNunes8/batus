"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import {
  sendPasswordReset,
  signInWithPassword,
  signUpWithPassword,
  type AuthState,
} from "./actions";

type Mode = "signin" | "signup" | "magic" | "magic-sent";

const initial: AuthState = null;

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  // Lift email up so it survives wrong-password retries, tab switches,
  // and the "Esqueci-me" sub-flow without making the user re-type it.
  // Password stays uncontrolled — that one should clear on failure.
  const [email, setEmail] = useState("");

  const [signinState, signinAction, signinPending] = useActionState(
    signInWithPassword,
    initial,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signUpWithPassword,
    initial,
  );
  const [magicState, magicAction, magicPending] = useActionState(
    sendPasswordReset,
    initial,
  );

  useEffect(() => {
    if (magicState?.status === "sent") {
      setMode("magic-sent");
    }
  }, [magicState]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-500"
        aria-label={studio.fullName}
      >
        {studio.brand.logo?.stacked ? (
          <Image
            src={studio.brand.logo.stacked}
            alt={studio.fullName}
            width={320}
            height={320}
            priority
            className="size-24 object-contain sm:size-28"
          />
        ) : (
          <span className="font-display text-3xl tracking-[0.08em]">
            {studio.name.toUpperCase()}
          </span>
        )}
        <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Boxe &amp; Kickboxing · {studio.city}
        </p>
      </Link>

      <div className="mt-10 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        {mode === "magic-sent" ? (
          <MagicSentState email={magicState?.email ?? email} />
        ) : mode === "magic" ? (
          <MagicForm
            action={magicAction}
            state={magicState}
            pending={magicPending}
            email={email}
            onEmailChange={setEmail}
            onBack={() => setMode("signin")}
          />
        ) : (
          <>
            <Tabs mode={mode} onChange={setMode} />

            {mode === "signin" ? (
              <SignInForm
                action={signinAction}
                state={signinState}
                pending={signinPending}
                email={email}
                onEmailChange={setEmail}
                onForgot={() => setMode("magic")}
              />
            ) : (
              <SignUpForm
                action={signupAction}
                state={signupState}
                pending={signupPending}
                email={email}
                onEmailChange={setEmail}
              />
            )}
          </>
        )}
      </div>

      <Link
        href="/"
        className="mt-12 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        ← Voltar ao site
      </Link>
    </div>
  );
}

function Tabs({
  mode,
  onChange,
}: {
  mode: "signin" | "signup";
  onChange: (m: "signin" | "signup") => void;
}) {
  // iOS-style segmented control. Filled pill for the active state makes the
  // selected mode unmistakable — much clearer than a thin bottom-border.
  return (
    <div
      role="tablist"
      className="flex rounded-md border border-border/60 bg-muted/40 p-1"
    >
      <TabButton active={mode === "signin"} onClick={() => onChange("signin")}>
        Entrar
      </TabButton>
      <TabButton active={mode === "signup"} onClick={() => onChange("signup")}>
        Criar conta
      </TabButton>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 rounded-sm py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}


function SignInForm({
  action,
  state,
  pending,
  email,
  onEmailChange,
  onForgot,
}: {
  action: (formData: FormData) => void;
  state: AuthState;
  pending: boolean;
  email: string;
  onEmailChange: (v: string) => void;
  onForgot: () => void;
}) {
  return (
    <form action={action} className="mt-8 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email" className="text-base">
          Email
        </Label>
        <Input
          id="signin-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="o.teu@email.com"
          className="h-12 text-base"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="signin-password" className="text-base">
            Palavra-passe
          </Label>
          <button
            type="button"
            onClick={onForgot}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Esqueci-me
          </button>
        </div>
        <PasswordInput
          id="signin-password"
          autoComplete="current-password"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full text-base"
      >
        {pending ? "A entrar…" : "Entrar"}
      </Button>
    </form>
  );
}

function SignUpForm({
  action,
  state,
  pending,
  email,
  onEmailChange,
}: {
  action: (formData: FormData) => void;
  state: AuthState;
  pending: boolean;
  email: string;
  onEmailChange: (v: string) => void;
}) {
  return (
    <form action={action} className="mt-8 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-email" className="text-base">
          Email
        </Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="o.teu@email.com"
          className="h-12 text-base"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password" className="text-base">
          Palavra-passe
        </Label>
        <PasswordInput
          id="signup-password"
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full text-base"
      >
        {pending ? "A criar conta…" : "Criar conta"}
      </Button>

      <p className="pt-2 text-center text-xs text-muted-foreground">
        Ao criar conta, aceitas os{" "}
        <Link href="/termos" className="text-foreground hover:underline">
          termos
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="text-foreground hover:underline">
          privacidade
        </Link>
        .
      </p>
    </form>
  );
}

function MagicForm({
  action,
  state,
  pending,
  email,
  onEmailChange,
  onBack,
}: {
  action: (formData: FormData) => void;
  state: AuthState;
  pending: boolean;
  email: string;
  onEmailChange: (v: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="text-center">
        <h1 className="font-display text-2xl tracking-wide">
          REPOR PALAVRA-PASSE
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esquecemo-nos todos. Vamos enviar-te um email com um link para
          definires uma nova palavra-passe.
        </p>
      </div>

      <form action={action} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="magic-email" className="text-base">
            Email
          </Label>
          <Input
            id="magic-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="o.teu@email.com"
            className="h-12 text-base"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="h-12 w-full text-base"
        >
          {pending ? "A enviar…" : "Enviar link"}
        </Button>

        <button
          type="button"
          onClick={onBack}
          className="block w-full text-center text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          ← Voltar ao login
        </button>
      </form>
    </div>
  );
}

function MagicSentState({ email }: { email: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-border/60 bg-muted/40">
        <Mail className="size-6 text-foreground" />
      </div>
      <h1 className="mt-6 font-display text-2xl tracking-wide">
        ENVIÁMOS-TE UM EMAIL
      </h1>
      {email && (
        <p className="mt-3 text-sm text-foreground/80">
          Para <span className="break-words font-medium">{email}</span>.
        </p>
      )}

      <ol className="mt-8 space-y-3 text-left text-sm">
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] text-background">
            1
          </span>
          <span>Abre a tua aplicação de email.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] text-background">
            2
          </span>
          <span>Procura por um email do Batus.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] text-background">
            3
          </span>
          <span>Carrega no link e define a nova palavra-passe.</span>
        </li>
      </ol>

      <div className="mt-8 rounded-md border border-border/60 bg-muted/30 p-4 text-left text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Não vês o email?</p>
        <ul className="mt-1.5 list-inside list-disc space-y-1">
          <li>Verifica a pasta de spam ou lixo.</li>
          <li>Confirma que escreveste bem o email.</li>
          <li>Pede ao treinador para te ajudar.</li>
        </ul>
      </div>

      <Link
        href="/login"
        className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        ← Tentar de novo
      </Link>
    </div>
  );
}
