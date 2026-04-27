import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-display text-7xl tracking-[0.08em] text-muted-foreground sm:text-9xl">
        404
      </p>
      <h1 className="mt-4 font-display text-2xl tracking-wider sm:text-3xl">
        PÁGINA NÃO ENCONTRADA
      </h1>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        A página que procuravas não existe ou foi movida.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button render={<Link href="/" />} nativeButton={false}>
          Voltar ao início
        </Button>
        <Button
          render={<Link href="/aulas" />}
          nativeButton={false}
          variant="outline"
        >
          Ver horário
        </Button>
      </div>
    </div>
  );
}
