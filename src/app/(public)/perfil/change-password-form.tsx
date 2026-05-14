"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { changePassword, type ChangePasswordState } from "./actions";

const initial: ChangePasswordState = null;

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new_password" className="text-base">
          Nova palavra-passe
        </Label>
        <PasswordInput
          id="new_password"
          name="new_password"
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password" className="text-base">
          Confirmar
        </Label>
        <PasswordInput
          id="confirm_password"
          name="confirm_password"
          autoComplete="new-password"
          placeholder="Escreve a mesma para confirmares"
        />
        <p className="text-xs text-muted-foreground">
          Usa o 👁 para veres o que estás a escrever.
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <SubmitButton
        className="h-11 text-base"
        pendingText="A alterar…"
      >
        Alterar palavra-passe
      </SubmitButton>
    </form>
  );
}
