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
import {
  rescheduleClassInstance,
  rescheduleSoloInstance,
} from "@/app/admin/calendar/actions";

const BUTTON_MOBILE_CLASSES = "h-11 text-base sm:h-9 sm:text-sm";

export function RescheduleDialog({
  kind,
  template_id,
  instance_date,
  current_start_time,
  label,
}: {
  kind: "group" | "solo";
  template_id: string;
  instance_date: string;
  current_start_time: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action =
    kind === "group" ? rescheduleClassInstance : rescheduleSoloInstance;

  // Wrap the server action so we can close the dialog + refresh after.
  async function handleAction(formData: FormData) {
    await action(formData);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground">
        Adiar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adiar</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {label} — escolhe uma nova hora para este dia.
          </p>
        </DialogHeader>

        <form action={handleAction} className="space-y-4">
          <input type="hidden" name="template_id" value={template_id} />
          <input type="hidden" name="instance_date" value={instance_date} />

          <div className="space-y-2">
            <Label htmlFor="new_start_time">Nova hora</Label>
            <Input
              id="new_start_time"
              name="new_start_time"
              type="time"
              defaultValue={current_start_time.slice(0, 5)}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Move só esta ocorrência. As próximas semanas mantêm o horário
              original.
            </p>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className={BUTTON_MOBILE_CLASSES}
            >
              Voltar
            </Button>
            <SubmitButton
              className={BUTTON_MOBILE_CLASSES}
              pendingText="A adiar…"
            >
              Adiar
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
