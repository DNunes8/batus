"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

// Drop-in for <Button type="submit"> that disables and changes its
// label while the parent form's server action is running. Prevents
// double-clicks on slow connections — important for non-tech users
// who otherwise tap repeatedly when a button "doesn't seem to do
// anything" within the first 200ms.
type Props = Omit<ComponentProps<typeof Button>, "type" | "disabled"> & {
  pendingText?: string;
};

export function SubmitButton({
  children,
  pendingText = "A processar…",
  ...props
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
