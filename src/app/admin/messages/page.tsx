import { Inbox, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmForm } from "@/components/confirm-form";
import { cn } from "@/lib/utils";
import {
  deleteMessage,
  markMessageRead,
  markMessageUnread,
} from "./actions";

export const dynamic = "force-dynamic";

// Normalise a stored phone into a wa.me number: digits only, drop a leading
// "00" international prefix, and turn a bare 9-digit PT mobile (9xxxxxxxx) into
// full international form (351…). wa.me needs the country code with no "+",
// spaces or leading zeros. Returns null for anything that doesn't look like a
// reachable mobile (landlines, junk) — those fall back to Email only.
function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith("9")) digits = `351${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

// First name, capitalised, for the greeting ("rodrigo faria" → "Rodrigo").
function firstName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

// WhatsApp glyph (lucide has none). fill=currentColor so it inherits the
// button's green text.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.33A10 10 0 1 0 12 2zm0 18.2c-1.5 0-2.96-.4-4.24-1.16l-.3-.18-3 .79.8-2.93-.2-.31A8.2 8.2 0 1 1 12 20.2zm4.7-6.13c-.26-.13-1.53-.76-1.77-.84-.24-.09-.41-.13-.58.13-.17.26-.67.84-.82 1.01-.15.17-.3.19-.56.06-.26-.13-1.1-.4-2.1-1.29-.78-.69-1.3-1.55-1.45-1.81-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.46.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.07-.13-.58-1.4-.8-1.92-.21-.5-.42-.43-.58-.44h-.5c-.17 0-.44.06-.67.32-.23.26-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.78 2.72 4.3 3.81.6.26 1.07.42 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.53-.63 1.75-1.23.22-.6.22-1.12.15-1.23-.06-.11-.24-.17-.5-.3z" />
    </svg>
  );
}

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

            // Reply hand-offs — plain links, no backend. WhatsApp only when the
            // number looks like a reachable mobile; Email whenever we have one.
            // The email body is a SINGLE line on purpose: iOS Mail turns
            // multi-line mailto bodies into literal "<BR>" text.
            const fname = firstName(m.name);
            const waNum = waNumber(m.phone);
            const waHref = waNum
              ? `https://wa.me/${waNum}?text=${encodeURIComponent(
                  `${fname ? `Olá ${fname}!` : "Olá!"} 👋 Obrigado pelo teu contacto com a Batus.`,
                )}`
              : null;
            const mailHref = m.email
              ? `mailto:${m.email}?subject=${encodeURIComponent(
                  "A tua mensagem para a Batus Boxe",
                )}&body=${encodeURIComponent(
                  `${fname ? `Olá ${fname}, ` : "Olá, "}obrigado pelo teu contacto com a Batus. `,
                )}`
              : null;

            return (
              <div
                key={m.id}
                className={`rounded-md border p-4 ${
                  isUnread
                    ? "border-foreground/30 bg-muted/20"
                    : "border-border/60"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {m.name}
                      {isUnread && (
                        <span className="ml-2 inline-block rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-background">
                          Nova
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="break-all">{m.email}</span>
                      {m.phone && <> · {m.phone}</>} · {when}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {isUnread ? (
                      <form action={markMessageRead} className="flex-1 sm:flex-none">
                        <input type="hidden" name="id" value={m.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          className="h-11 w-full text-base sm:h-9 sm:text-sm"
                        >
                          Marcar lida
                        </Button>
                      </form>
                    ) : (
                      <form action={markMessageUnread} className="flex-1 sm:flex-none">
                        <input type="hidden" name="id" value={m.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          className="h-11 w-full text-base sm:h-9 sm:text-sm"
                        >
                          Marcar por ler
                        </Button>
                      </form>
                    )}
                    <ConfirmForm
                      message={`Apagar a mensagem de ${m.name}? Não dá para desfazer.`}
                      action={deleteMessage}
                      className="flex-1 sm:flex-none"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        className="h-11 w-full text-base text-destructive sm:h-9 sm:text-sm"
                      >
                        Apagar
                      </Button>
                    </ConfirmForm>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>

                {(waHref || mailHref) && (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                      Responder
                    </p>
                    <div className="flex gap-2">
                      {waHref && (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "h-11 flex-1 gap-2 px-4 text-base sm:h-9 sm:flex-none sm:text-sm",
                            "border-[#bfe6cd] bg-[#e9f7ee] text-[#0f7d4d] hover:bg-[#ddf1e5] hover:text-[#0b6b42]",
                            "dark:border-[oklch(0.44_0.07_152)] dark:bg-[oklch(0.30_0.05_152)] dark:text-[oklch(0.86_0.12_152)] dark:hover:bg-[oklch(0.34_0.05_152)] dark:hover:text-[oklch(0.9_0.12_152)]",
                          )}
                        >
                          <WhatsAppIcon className="size-4" />
                          WhatsApp
                        </a>
                      )}
                      {mailHref && (
                        <a
                          href={mailHref}
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "h-11 flex-1 gap-2 px-4 text-base sm:h-9 sm:flex-none sm:text-sm",
                          )}
                        >
                          <Mail className="size-4" />
                          Email
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
