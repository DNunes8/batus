import Link from "next/link";
import { studio, configured } from "@/lib/studio.config";

export const metadata = {
  title: `Termos — ${studio.fullName}`,
  description: `Termos e condições de utilização do site e dos serviços do ${studio.fullName}.`,
};

export default function TermosPage() {
  const email = configured(studio.contact.email);

  const reachUs = email ? (
    <>
      escreve para{" "}
      <a
        href={`mailto:${email}`}
        className="underline underline-offset-2 hover:text-foreground"
      >
        {email}
      </a>
    </>
  ) : (
    <>
      usa a{" "}
      <Link
        href="/contacto"
        className="underline underline-offset-2 hover:text-foreground"
      >
        página de Contacto
      </Link>
    </>
  );

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Termos e Condições
      </p>
      <h1 className="mt-6 font-display text-4xl tracking-[0.04em] sm:text-5xl">
        TERMOS
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: {studio.legal.lastUpdated}
      </p>

      <p className="mt-8 text-base leading-relaxed text-foreground/80">
        Estes termos regulam a utilização do site do {studio.fullName} e a
        marcação das aulas e serviços do estúdio. Ao criares conta ou ao usares
        este site, aceitas estes termos. Lê-os com atenção — em especial a
        secção 7, sobre os riscos da prática.
      </p>

      <div className="mt-12 space-y-10 text-base leading-relaxed text-foreground/80">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Quem somos
          </h2>
          <p className="mt-2">
            O {studio.fullName} é um estúdio de boxe e kickboxing em{" "}
            {studio.city}, {studio.country}, do treinador {studio.coach}. Este
            site permite-te conhecer o estúdio, criar conta, marcar e gerir
            aulas e reservar artigos da loja. A identificação legal do estúdio
            (responsável) consta da{" "}
            <Link
              href="/privacidade"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Conta e acesso
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>
              Para marcares aulas precisas de criar conta com email e
              palavra-passe.
            </li>
            <li>
              As contas destinam-se a maiores de 18 anos. Se és menor de idade,
              só podes treinar no estúdio com o consentimento do teu encarregado
              de educação, que aceita estes termos em teu nome; as marcações são
              geridas por um adulto responsável.
            </li>
            <li>
              És responsável por manteres a tua palavra-passe segura e por toda
              a atividade feita na tua conta. Avisa-nos se suspeitares de uso
              indevido.
            </li>
            <li>
              Comprometes-te a fornecer informação verdadeira e a mantê-la
              atualizada no teu Perfil.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Marcações, lista de espera e cancelamentos
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>As marcações são pessoais e não transferíveis.</li>
            <li>
              Se uma aula estiver cheia, podes entrar na lista de espera. Se
              abrir uma vaga, podes ser promovido automaticamente para a aula.
            </li>
            <li>
              Podes cancelar uma marcação até ao limite definido pelo estúdio
              antes do início da aula — atualmente 4 horas. Este período pode
              ser ajustado pelo estúdio.
            </li>
            <li>
              Cancela sempre que não puderes comparecer, para libertares o lugar
              para outro aluno.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Faltas</h2>
          <p className="mt-2">
            Faltar a uma aula marcada sem cancelar, ou cancelar fora do prazo,
            ocupa um lugar que outro aluno poderia ter usado. Faltas ou
            cancelamentos tardios repetidos podem ser tidos em conta pelo estúdio
            — por exemplo, na tua mensalidade ou no acesso a marcações. As regras
            concretas são definidas e comunicadas pelo estúdio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Pagamentos e mensalidades
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>
              Este site não processa pagamentos. As mensalidades, packs ou aulas
              avulso são pagos diretamente ao estúdio (transferência bancária,
              MBWay ou em pessoa).
            </li>
            <li>
              Os preços são comunicados no estúdio e podem ser revistos, com
              aviso prévio razoável.
            </li>
            <li>
              O site regista, para cada mês, se a tua mensalidade está paga —
              para que tu e o estúdio tenham um registo claro.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Loja online
          </h2>
          <p className="mt-2">
            Os artigos disponíveis na loja do site são reservados online e
            levantados em pessoa no estúdio. A reserva não é uma compra: o
            pagamento é feito no momento do levantamento. O stock é limitado e
            uma reserva garante o artigo apenas por um período razoável —
            reservas não levantadas podem ser canceladas pelo estúdio para
            libertar o artigo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Riscos da prática e condição física
          </h2>
          <p className="mt-2">
            O boxe, o kickboxing e outras modalidades de combate são
            desportos de contacto e de esforço físico intenso, com risco inerente
            de lesão (contusões e lesões musculares ou articulares, entre
            outras). Ao participares:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>
              declaras que conheces e aceitas os riscos inerentes à prática;
            </li>
            <li>
              declaras estar em condições físicas adequadas para treinar e, em
              caso de dúvida, comprometes-te a consultar um médico antes de
              começar ou de retomar;
            </li>
            <li>
              comprometes-te a informar o treinador de lesões, limitações ou
              condições de saúde relevantes para a tua segurança;
            </li>
            <li>
              comprometes-te a seguir as instruções do treinador e a usar o
              equipamento de proteção indicado.
            </li>
          </ul>
          <p className="mt-3">
            No caso de um menor, é o encarregado de educação que faz estas
            declarações e dá este consentimento em seu nome.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Regras do estúdio e conduta
          </h2>
          <p className="mt-2">No estúdio, pedimos que:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>chegues a horas e respeites o treinador e os outros alunos;</li>
            <li>cuides da higiene pessoal e do teu equipamento;</li>
            <li>
              uses o equipamento do estúdio de forma adequada e comuniques
              qualquer dano;
            </li>
            <li>
              não filmes nem fotografes outras pessoas sem o consentimento
              delas.
            </li>
          </ul>
          <p className="mt-3">
            O estúdio pode definir regras adicionais, comunicadas no espaço ou no
            site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. Suspensão de acesso
          </h2>
          <p className="mt-2">
            O estúdio pode limitar ou suspender o acesso às marcações, ou à
            conta, em caso de incumprimento destes termos, falta de pagamento ou
            comportamento que ponha em risco a segurança ou o bom ambiente do
            estúdio. Sempre que possível, isto será falado contigo primeiro.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            10. Conteúdos e propriedade intelectual
          </h2>
          <p className="mt-2">
            O nome, o logótipo, os textos, as fotografias e os vídeos do{" "}
            {studio.name} pertencem ao estúdio ou aos respetivos autores e não
            podem ser reproduzidos ou usados sem autorização. Podes usar o site
            apenas para os fins a que se destina.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            11. Limitação de responsabilidade
          </h2>
          <p className="mt-2">
            O estúdio compromete-se a prestar as aulas com o cuidado e a
            competência esperados, com instrução qualificada e equipamento em
            condições. Dentro dos limites permitidos por lei, o estúdio não é
            responsável por danos resultantes:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>
              do incumprimento das instruções do treinador ou das regras do
              estúdio;
            </li>
            <li>
              da não comunicação de uma lesão ou condição de saúde relevante;
            </li>
            <li>de causas alheias ao controlo do estúdio.</li>
          </ul>
          <p className="mt-3">
            Nada nestes termos exclui ou limita a responsabilidade do estúdio nos
            casos em que a lei não o permite, designadamente por danos causados à
            vida ou à integridade física por culpa do estúdio. Quanto ao site, é
            disponibilizado tal como está; embora nos esforcemos por mantê-lo
            disponível e correto, podem ocorrer interrupções ou erros pontuais.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            12. Alterações aos termos
          </h2>
          <p className="mt-2">
            Podemos atualizar estes termos — por exemplo, ao acrescentar
            funcionalidades ao site. A data da última atualização está no topo da
            página. Ao continuares a usar o site após uma alteração, aceitas a
            versão atualizada; alterações significativas serão comunicadas de
            forma visível.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            13. Lei aplicável e resolução de litígios
          </h2>
          <p className="mt-2">
            Estes termos regem-se pela lei portuguesa. Em caso de dúvida ou
            desacordo, contacta-nos primeiro: {reachUs}. Procuramos resolver
            qualquer questão diretamente e de boa-fé.
          </p>
          <p className="mt-3">
            Enquanto consumidor, tens ao teu dispor o Livro de Reclamações na sua
            versão eletrónica, em www.livroreclamacoes.pt. Em caso de litígio de
            consumo, podes ainda recorrer a uma entidade de resolução alternativa
            de litígios de consumo (RAL); na região de Braga é competente o CIAB
            — Centro de Informação, Mediação e Arbitragem de Consumo
            (www.ciab.pt). Mais informação em www.consumidor.gov.pt.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            14. Contacto
          </h2>
          <p className="mt-2">
            Para qualquer questão sobre estes termos, {reachUs}. Consulta também
            a nossa{" "}
            <Link
              href="/privacidade"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </section>
      </div>
    </section>
  );
}
