import { studio } from "@/lib/studio.config";

export const metadata = {
  title: `Termos — ${studio.fullName}`,
};

export default function TermosPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Termos e Condições
      </p>
      <h1 className="mt-6 font-display text-4xl tracking-[0.04em] sm:text-5xl">
        TERMOS
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: {new Date().getFullYear()}
      </p>

      <div className="mt-12 space-y-8 text-base leading-relaxed text-foreground/80">
        <section>
          <h2 className="font-semibold">Utilização do site</h2>
          <p className="mt-2">
            Ao usares este site para marcar aulas, concordas em fornecer
            informação verdadeira e em respeitar as regras do estúdio.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Marcações e cancelamentos</h2>
          <p className="mt-2">
            As marcações são pessoais e não transferíveis. Podes cancelar uma
            aula até 4 horas antes do início (este período pode ser ajustado
            pelo estúdio). Marcações canceladas fora desse prazo podem contar
            para a tua mensalidade.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Riscos da prática</h2>
          <p className="mt-2">
            Boxe e kickboxing são desportos de contacto. Ao participares,
            assumes que conheces os riscos associados (lesões musculares,
            articulares, contusões, etc.) e que estás em condições físicas
            adequadas. Em caso de dúvida, consulta um médico antes de começar.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Pagamentos</h2>
          <p className="mt-2">
            Os pagamentos são acertados diretamente com o estúdio (transferência
            bancária, MBWay, ou em pessoa). Este site não processa pagamentos.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Mensalidades</h2>
          <p className="mt-2">
            Os preços das mensalidades, packs ou aulas avulso são comunicados no
            estúdio. Podem ser revistos com aviso prévio.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Conteúdo da loja</h2>
          <p className="mt-2">
            Os artigos reservados na loja online são levantados em pessoa no
            estúdio. O pagamento é feito no momento do levantamento. Reservas
            não levantadas podem ser canceladas pelo estúdio.
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
