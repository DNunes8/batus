"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import {
  sendMagicLink,
  signInWithPassword,
  signUpWithPassword,
  type AuthState,
} from "./actions";

type Mode = "signin" | "signup" | "magic" | "magic-sent";

const initial: AuthState = null;

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");

  const [signinState, signinAction, signinPending] = useActionState(
    signInWithPassword,
    initial,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signUpWithPassword,
    initial,
  );
  const [magicState, magicAction, magicPending] = useActionState(
    sendMagicLink,
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
        className="block animate-in fade-in slide-in-from-bottom-2 duration-500"
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
          <div className="text-center">
            <span className="font-display text-3xl tracking-[0.08em]">
              {studio.name.toUpperCase()}
            </span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Boxing &amp; Training
            </span>
          </div>
        )}
      </Link>

      <div className="mt-10 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        {mode === "magic-sent" ? (
          <MagicSentState email={magicState?.email ?? ""} />
        ) : mode === "magic" ? (
          <MagicForm
            action={magicAction}
            state={magicState}
            pending={magicPending}
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
                onForgot={() => setMode("magic")}
              />
            ) : (
              <SignUpForm
                action={signupAction}
                state={signupState}
                pending={signupPending}
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
  return (
    <div
      role="tablist"
      className="grid grid-cols-2 gap-0 border-b border-border"
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
      className={`pb-3 pt-1 text-sm font-medium tracking-wide transition-colors ${
        active
          ? "border-b-2 border-foreground text-foreground"
          : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
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
  onForgot,
}: {
  action: (formData: FormData) => void;
  state: AuthState;
  pending: boolean;
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
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signin-password" className="text-base">
          Palavra-passe
        </Label>
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

      <button
        type="button"
        onClick={onForgot}
        className="block w-full text-center text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        Esqueci-me da palavra-passe →
      </button>
    </form>
  );
}

function SignUpForm({
  action,
  state,
  pending,
}: {
  action: (formData: FormData) => void;
  state: AuthState;
  pending: boolean;
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
        <p className="text-xs text-muted-foreground">
          Carrega em 👁 para veres o que estás a escrever.
        </p>
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
  onBack,
}: {
  action: (formData: FormData) => void;
  state: AuthState;
  pending: boolean;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="text-center">
        <h1 className="font-display text-2xl tracking-wide">
          ENTRAR SEM PALAVRA-PASSE
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esquecemo-nos todos. Vamos enviar-te um link para entrares, e podes
          definir uma nova palavra-passe depois.
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
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-foreground/5 text-2xl">
        📧
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
          <span>Procura por um email do Batus (assunto "Entra no Batus").</span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] text-background">
            3
          </span>
          <span>Carrega no link — ficas dentro.</span>
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
