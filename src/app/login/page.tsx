"use client";

import { useActionState } from "react";
import Link from "next/link";
import { studio } from "@/lib/studio.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="block text-center">
        <span className="font-display text-3xl tracking-[0.08em]">
          {studio.name.toUpperCase()}
        </span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Boxing &amp; Training
        </span>
      </Link>

      <div className="mt-12 w-full max-w-sm">
        {state.status === "sent" ? (
          <div className="text-center">
            <h1 className="font-display text-2xl tracking-wide">
              VERIFICA O TEU EMAIL
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Enviámos um link para{" "}
              <span className="text-foreground">{state.email}</span>. Clica para
              entrar.
            </p>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="o.teu@email.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {state.status === "error" && state.message && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "A enviar…" : "Continuar"}
            </Button>

            <p className="pt-2 text-center text-xs text-muted-foreground">
              Enviamos um link mágico. Sem palavras-passe.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
