"use client";

// Shown when a gate couldn't reach Supabase Auth to confirm the session (a
// transient network/throttle blip), instead of bouncing the user to /login.
// The whole point: the session is still valid, so we must NOT make them retype
// their password. A single manual "try again" keeps it dead simple and — unlike
// an auto-reload loop — can never hammer the free tier during a real outage.
export function Reconnecting() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="max-w-sm space-y-2">
        <h1 className="font-display text-2xl tracking-[0.04em]">Sem ligação</h1>
        <p className="text-sm text-muted-foreground">
          Não deu para falar com o servidor por instantes. A tua sessão está
          guardada — não precisas de entrar outra vez.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="h-11 rounded-md bg-foreground px-6 text-sm font-medium uppercase tracking-wider text-background transition-opacity hover:opacity-90"
      >
        Tentar de novo
      </button>
    </div>
  );
}
