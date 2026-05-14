"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { formatEuro } from "@/lib/money";
import { setDefaultMonthlyFee } from "./actions";

// Small inline button + dialog so the coach can edit the studio-wide default
// monthly fee. Per-student overrides live on /admin/students/[id].
export function DefaultFeeButton({ currentCents }: { currentCents: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleAction(formData: FormData) {
    await setDefaultMonthlyFee(formData);
    setOpen(false);
    router.refresh();
  }

  const defaultEur = (currentCents / 100).toFixed(2).replace(".", ",");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground">
        Mensalidade padrão: {formatEuro(currentCents)} · Editar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mensalidade padrão</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Aplica-se a alunos sem valor personalizado. Pode ser ajustado por
            aluno no perfil.
          </p>
        </DialogHeader>
        <form action={handleAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-fee">Valor (€)</Label>
            <Input
              id="default-fee"
              name="amount"
              defaultValue={defaultEur}
              inputMode="decimal"
              required
              autoFocus
              className="h-11 text-base sm:h-9 sm:text-sm"
            />
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-11 text-base sm:h-9 sm:text-sm"
            >
              Voltar
            </Button>
            <SubmitButton
              className="h-11 text-base sm:h-9 sm:text-sm"
              pendingText="A guardar…"
            >
              Guardar
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
