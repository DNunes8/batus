"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

// Password input with a 👁 toggle to reveal the value — helps non-tech
// users catch typos before they submit. Re-used on /login, /bem-vindo,
// /perfil (change password).
export function PasswordInput({
  id,
  name = "password",
  autoComplete,
  placeholder,
  required = true,
  defaultValue,
}: {
  id: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-12 pr-12 text-base"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
        className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
