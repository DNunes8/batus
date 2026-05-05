"use client";

import { useActionState } from "react";
import Link from "next/link";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signInWithGoogle, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8431 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.6154z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.806.54-1.8368.8595-3.0477.8595-2.344 0-4.3282-1.5832-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:py-16">
      <Link href="/" className="block text-center">
        <span className="font-display text-3xl tracking-[0.08em]">
          {studio.name.toUpperCase()}
        </span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Boxing &amp; Training
        </span>
      </Link>

      <div className="mt-10 w-full max-w-sm sm:mt-12">
        {state.status === "sent" ? (
          <SentState email={state.email!} />
        ) : (
          <>
            <div className="text-center">
              <h1 className="font-display text-2xl tracking-wide">ENTRAR</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Marca aulas, vê o teu histórico e gere a tua conta.
              </p>
            </div>

            {/* Google one-tap */}
            <form action={signInWithGoogle} className="mt-8">
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-border bg-background text-sm font-medium transition-colors hover:bg-muted active:scale-[0.99]"
              >
                <GoogleIcon />
                Entrar com Google
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou com email
              <span className="h-px flex-1 bg-border" />
            </div>

            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="o.teu@email.com"
                  required
                  autoComplete="email"
                  inputMode="email"
                  className="h-12 text-base"
                />
              </div>

              {state.status === "error" && state.message && (
                <p className="text-sm text-destructive">{state.message}</p>
              )}

              <Button
                type="submit"
                className="h-12 w-full text-base"
                disabled={pending}
              >
                {pending ? "A enviar…" : "Continuar com email"}
              </Button>

              <p className="pt-2 text-center text-xs text-muted-foreground">
                Sem palavras-passe — enviamos-te um link para entrares.
              </p>
            </form>
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

function SentState({ email }: { email: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-foreground/5">
        <span className="text-2xl">📧</span>
      </div>
      <h1 className="mt-6 font-display text-2xl tracking-wide">
        ENVIÁMOS-TE UM EMAIL
      </h1>
      <p className="mt-3 text-sm text-foreground/80">
        Para{" "}
        <span className="font-medium text-foreground break-words">{email}</span>
      </p>

      <ol className="mt-8 space-y-3 text-left text-sm">
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] text-background">
            1
          </span>
          <span>Abre a tua aplicação de email no telemóvel ou computador.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] text-background">
            2
          </span>
          <span>
            Procura por um email com assunto{" "}
            <span className="font-medium">"Entra no Batus"</span>.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] text-background">
            3
          </span>
          <span>Carrega no link dentro do email — ficas dentro.</span>
        </li>
      </ol>

      <div className="mt-8 rounded-md border border-border/60 bg-muted/30 p-4 text-left text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Não vês o email?</p>
        <ul className="mt-1.5 list-inside list-disc space-y-1">
          <li>Confirma que escreveste bem o email.</li>
          <li>Verifica a pasta de spam ou lixo.</li>
          <li>Espera 1 minuto e tenta enviar de novo.</li>
        </ul>
      </div>

      <div className="mt-6">
        <Link
          href="/login"
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          ← Tentar com outro email
        </Link>
      </div>
    </div>
  );
}
