import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/confirm-form";
import {
  deleteMessage,
  markMessageRead,
  markMessageUnread,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });

  const unreadCount = messages?.filter((m) => !m.read_at).length ?? 0;

  return (
    <div className="p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Mensagens
      </p>
      <h1 className="mt-4 font-display text-3xl tracking-[0.04em] sm:text-4xl">
        CONTACTOS
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {messages?.length ?? 0} mensagens · {unreadCount} por ler
      </p>

      {!messages || messages.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-md border border-dashed border-border/60 px-6 py-16 text-center">
          <Inbox className="size-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">
            Caixa de mensagens vazia.
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
            Mensagens enviadas pelo formulário de contacto aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-3">
          {messages.map((m) => {
            const when = new Date(m.created_at).toLocaleString("pt-PT", {
              dateStyle: "short",
              timeStyle: "short",
            });
            const isUnread = !m.read_at;
            return (
              <div
                key={m.id}
                className={`rounded-md border p-4 ${
                  isUnread
                    ? "border-foreground/30 bg-muted/20"
                    : "border-border/60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {m.name}
                      {isUnread && (
                        <span className="ml-2 inline-block rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-background">
                          Nova
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.email}
                      {m.phone && ` · ${m.phone}`} · {when}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isUnread ? (
                      <form action={markMessageRead}>
                        <input type="hidden" name="id" value={m.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Marcar como lida
                        </Button>
                      </form>
                    ) : (
                      <form action={markMessageUnread}>
                        <input type="hidden" name="id" value={m.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Marcar por ler
                        </Button>
                      </form>
                    )}
                    <ConfirmForm
                      message={`Apagar a mensagem de ${m.name}? Não dá para desfazer.`}
                      action={deleteMessage}
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                      >
                        Apagar
                      </Button>
                    </ConfirmForm>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
