"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Erro
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-wider sm:text-4xl">
        ALGO CORREU MAL
      </h1>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        Tenta novamente. Se o problema continuar, contacta o estúdio.
      </p>
      {error.message && (
        <p className="mt-6 max-w-md rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground/80">
          {error.message}
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>Tentar de novo</Button>
        <Button
          render={<Link href="/" />}
          nativeButton={false}
          variant="outline"
        >
          Voltar ao início
        </Button>
      </div>
    </div>
  );
}
