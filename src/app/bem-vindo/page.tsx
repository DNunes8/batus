"use client";

import { Suspense, useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { studio } from "@/lib/studio.config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import {
  BIRTHDAY_DAYS,
  MONTHS_PT,
  birthYearOptions,
} from "@/lib/birthday";
import { completeProfile, type CompleteProfileState } from "./actions";

const initialState: CompleteProfileState = null;

// Matches the h-12 text-base look of the page's <Input>s so the three
// birthday selects sit flush with the name + phone fields above.
const BIG_SELECT_CLASSES =
  "flex h-12 w-full rounded-md border border-input bg-transparent px-3 text-base transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function BemVindoContent() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/aulas";
  const [state, formAction] = useActionState(completeProfile, initialState);

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
            width={300}
            height={300}
            priority
            className="size-24 object-contain sm:size-28"
          />
        ) : (
          <div className="text-center">
            <span className="font-display text-2xl tracking-[0.08em]">
              {studio.name.toUpperCase()}
            </span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Boxing &amp; Training
            </span>
          </div>
        )}
      </Link>

      <div className="mt-12 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center">
          <h1 className="font-display text-3xl leading-tight tracking-wide sm:text-4xl">
            BEM-VINDO
            <br />
            AO BATUS
          </h1>
          <p className="mt-4 text-sm text-foreground/80">
            Só faltam uns dados — o treinador precisa de saber quem és, te
            contactar, e desejar parabéns no dia.
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
              Telefone
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="9XX XXX XXX"
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground">
              Para o treinador te contactar quando precisar.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-base">Data de nascimento</Label>
            <div className="grid grid-cols-3 gap-2">
              <select
                name="birthday_day"
                required
                defaultValue=""
                aria-label="Dia"
                autoComplete="bday-day"
                className={BIG_SELECT_CLASSES}
              >
                <option value="" disabled>
                  Dia
                </option>
                {BIRTHDAY_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                name="birthday_month"
                required
                defaultValue=""
                aria-label="Mês"
                autoComplete="bday-month"
                className={BIG_SELECT_CLASSES}
              >
                <option value="" disabled>
                  Mês
                </option>
                {MONTHS_PT.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                name="birthday_year"
                required
                defaultValue=""
                aria-label="Ano"
                autoComplete="bday-year"
                className={BIG_SELECT_CLASSES}
              >
                <option value="" disabled>
                  Ano
                </option>
                {birthYearOptions().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Para o treinador te desejar parabéns no dia certo.
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
