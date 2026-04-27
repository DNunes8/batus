"use client";

import type { ReactNode } from "react";

// Drop-in replacement for <form> on destructive actions. Prompts the
// user with a native confirm() before submitting. The native dialog is
// not pretty, but it's familiar and accessible — exactly what a 50+
// non-tech user expects to see when something dangerous is about to
// happen.
export function ConfirmForm({
  message,
  action,
  children,
  className,
}: {
  message: string;
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
      className={className}
    >
      {children}
    </form>
  );
}
