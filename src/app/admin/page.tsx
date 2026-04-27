import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Dashboard
      </p>
      <h1 className="mt-4 font-display text-4xl tracking-[0.04em] sm:text-5xl">
        BEM-VINDO
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">{user?.email}</p>

      <p className="mt-16 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Em construção — métricas, agenda de hoje e atalhos chegam em breve.
      </p>
    </div>
  );
}
