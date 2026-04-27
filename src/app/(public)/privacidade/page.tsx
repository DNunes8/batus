import { studio } from "@/lib/studio.config";

export const metadata = {
  title: `Privacidade — ${studio.fullName}`,
};

export default function PrivacidadePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Política de Privacidade
      </p>
      <h1 className="mt-6 font-display text-4xl tracking-[0.04em] sm:text-5xl">
        PRIVACIDADE
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: {new Date().getFullYear()}
      </p>

      <div className="mt-12 space-y-8 text-base leading-relaxed text-foreground/80">
        <section>
          <h2 className="font-semibold">Quem somos</h2>
          <p className="mt-2">
            {studio.fullName}, em {studio.city}, {studio.country}. Contacto:{" "}
            {studio.contact.email}.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Que dados recolhemos</h2>
          <p className="mt-2">
            Apenas os dados necessários para gerir as tuas marcações: email,
            nome e telefone (se os fornecedores), e o histórico das tuas
            marcações de aula.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Para que servem</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Autenticar-te no site (link mágico por email).</li>
            <li>Permitir-te marcar e cancelar aulas.</li>
            <li>Permitir ao treinador organizar a aula e contactar-te.</li>
            <li>Manter um registo dos teus pagamentos e treinos.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">Os teus direitos</h2>
          <p className="mt-2">
            Tens direito a aceder, corrigir e eliminar os teus dados. Podes
            atualizar o teu perfil em <code className="font-mono">/perfil</code>{" "}
            ou pedir a eliminação total da conta enviando um email para{" "}
            {studio.contact.email}.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Onde guardamos</h2>
          <p className="mt-2">
            Os dados são guardados em servidores na União Europeia (Supabase,
            Frankfurt). Não partilhamos dados com terceiros para fins de
            marketing.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Cookies</h2>
          <p className="mt-2">
            Usamos apenas cookies essenciais para manter a tua sessão iniciada.
            Não usamos cookies de tracking nem partilhamos dados com redes de
            publicidade.
          </p>
        </section>

        <p className="rounded-md bg-muted/30 p-4 text-xs text-muted-foreground">
          Esta página é um placeholder a finalizar com texto legal definitivo
          antes do lançamento público. Para qualquer questão, contacta{" "}
          {studio.contact.email}.
        </p>
      </div>
    </section>
  );
}
