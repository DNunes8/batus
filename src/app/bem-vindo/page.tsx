"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { studio } from "@/lib/studio.config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { completeProfile, type CompleteProfileState } from "./actions";

const initialState: CompleteProfileState = null;

function BemVindoContent() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/aulas";
  const [state, formAction] = useActionState(completeProfile, initialState);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="block text-center animate-in fade-in slide-in-from-bottom-2 duration-500"
      >
        <span className="font-display text-2xl tracking-[0.08em]">
          {studio.name.toUpperCase()}
        </span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Boxing &amp; Training
        </span>
      </Link>

      <div className="mt-12 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-foreground/5 text-3xl">
            👋
          </div>
          <h1 className="mt-6 font-display text-3xl leading-tight tracking-wide sm:text-4xl">
            BEM-VINDO
            <br />
            AO BATUS
          </h1>
          <p className="mt-4 text-sm text-foreground/80">
            Só falta o teu nome — para o treinador saber quem és quando
            apareces.
          </p>
        </div>

        <form action={formAction} className="mt-10 space-y-5">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-base">
              Nome
            </Label>
            <Input
              id="full_name"
              name="full_name"
              required
              autoFocus
              autoComplete="name"
              placeholder="O teu nome"
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-base">
              Telefone{" "}
              <span className="text-xs font-normal text-muted-foreground">
                · opcional
              </span>
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="9XX XXX XXX"
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground">
              Caso o treinador precise de te contactar.
            </p>
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <SubmitButton
            className="h-12 w-full text-base"
            pendingText="A guardar…"
          >
            Continuar →
          </SubmitButton>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Podes sempre atualizar isto em{" "}
            <span className="text-foreground">Perfil</span>.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function BemVindoPage() {
  return (
    <Suspense fallback={null}>
      <BemVindoContent />
    </Suspense>
  );
}
