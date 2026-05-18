import Link from "next/link";
import { studio, configured } from "@/lib/studio.config";

export const metadata = {
  title: `Privacidade — ${studio.fullName}`,
  description: `Como o ${studio.fullName} recolhe, usa e protege os teus dados pessoais.`,
};

export default function PrivacidadePage() {
  const email = configured(studio.contact.email);
  const controller = configured(studio.legal.controller);
  const taxId = configured(studio.legal.taxId);
  const registeredAddress = configured(studio.legal.registeredAddress);

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
        Política de Privacidade
      </p>
      <h1 className="mt-6 font-display text-4xl tracking-[0.04em] sm:text-5xl">
        PRIVACIDADE
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: {studio.legal.lastUpdated}
      </p>

      <p className="mt-8 text-base leading-relaxed text-foreground/80">
        Esta política explica que dados pessoais o {studio.fullName} recolhe
        quando usas este site, para que servem e quais os teus direitos.
        Recolhemos apenas o mínimo necessário para gerir os treinos — sem
        publicidade e sem venda de dados.
      </p>

      <div className="mt-12 space-y-10 text-base leading-relaxed text-foreground/80">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Responsável pelo tratamento
          </h2>
          {controller ? (
            <p className="mt-2">
              O responsável pelo tratamento dos teus dados é {controller}
              {taxId ? `, com o NIF/NIPC ${taxId}` : ""}
              {registeredAddress ? `, com morada em ${registeredAddress}` : ""},
              que opera o estúdio {studio.fullName}, em {studio.city},{" "}
              {studio.country}. Para qualquer questão sobre privacidade,{" "}
              {reachUs}.
            </p>
          ) : (
            <p className="mt-2">
              Este site é operado pelo estúdio {studio.fullName}, do treinador{" "}
              {studio.coach}, em {studio.city}, {studio.country}. A
              identificação legal completa do responsável pelo tratamento (nome
              e número de identificação fiscal) será publicada nesta página
              antes do lançamento público do site. Para qualquer questão sobre
              privacidade, {reachUs}.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Que dados recolhemos
          </h2>
          <p className="mt-2">
            Consoante a forma como usas o site, podemos recolher:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">
                Dados de conta
              </span>{" "}
              — o teu email e palavra-passe. A palavra-passe é guardada de forma
              encriptada pelo serviço de autenticação; nunca a vemos.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Dados de perfil
              </span>{" "}
              — o teu nome e, se o indicares, o teu telefone.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Objetivos de treino
              </span>{" "}
              — se os escreveres no teu perfil.
            </li>
            <li>
              <span className="font-medium text-foreground">Marcações</span> —
              que aulas marcaste, cancelaste ou frequentaste, e a tua posição em
              lista de espera.
            </li>
            <li>
              <span className="font-medium text-foreground">Pagamentos</span> —
              o registo, mês a mês, de se a tua mensalidade está paga e do
              respetivo valor. O site não processa pagamentos nem guarda dados
              bancários ou de cartão.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Sessões individuais
              </span>{" "}
              — data, duração e valor de treinos 1:1, caso tenhas algum.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Notas do treinador
              </span>{" "}
              — notas internas que o treinador pode escrever sobre o teu treino
              (ver a secção 4).
            </li>
            <li>
              <span className="font-medium text-foreground">
                Mensagens de contacto
              </span>{" "}
              — se usares o formulário de contacto, guardamos o nome, o email, o
              telefone (se o indicares) e a mensagem.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Para que usamos os teus dados
          </h2>
          <p className="mt-2">Usamos os teus dados apenas para:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>
              criar a tua conta e autenticar-te no site — para te dar acesso à
              área de aluno (execução do contrato entre ti e o estúdio);
            </li>
            <li>
              permitir-te marcar e cancelar aulas e entrar em lista de espera —
              execução do contrato;
            </li>
            <li>
              permitir ao treinador organizar as aulas e contactar-te quando
              necessário — interesse legítimo do estúdio na gestão dos treinos;
            </li>
            <li>
              registar pagamentos e sessões para o estúdio acompanhar as
              mensalidades — execução do contrato e boa gestão do estúdio;
            </li>
            <li>
              responder às mensagens que nos envias pelo formulário de contacto
              — para tratar o teu pedido.
            </li>
          </ul>
          <p className="mt-3">
            Não usamos os teus dados para publicidade nem para decisões
            automatizadas.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Informação de saúde
          </h2>
          <p className="mt-2">
            O boxe e os desportos de combate exigem atenção à tua condição
            física. Se partilhares connosco informação sobre lesões, limitações
            ou condições de saúde — no perfil, por mensagem ou diretamente com o
            treinador — usamo-la apenas para tornar o teu treino mais seguro e
            adequado. Esta informação é sensível: só a registamos com o teu
            conhecimento e pedimos-te que partilhes apenas o que for relevante
            para treinares em segurança.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Quem tem acesso aos teus dados
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>
              O treinador e a administração do estúdio acedem aos dados
              necessários para gerir as aulas e as mensalidades.
            </li>
            <li>
              Os outros alunos não veem os teus dados. Numa aula, cada aluno vê
              apenas o número de lugares ocupados — nunca os nomes de quem
              marcou.
            </li>
            <li>
              Recorremos a fornecedores tecnológicos que tratam dados em nosso
              nome (subcontratantes), apenas para o site funcionar: alojamento,
              base de dados, autenticação e envio de emails de sistema (como a
              recuperação de palavra-passe).
            </li>
            <li>
              Não vendemos os teus dados nem os partilhamos com terceiros para
              fins de marketing.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Onde guardamos os teus dados
          </h2>
          <p className="mt-2">
            A base de dados e as contas são alojadas em servidores na União
            Europeia (Supabase, em Frankfurt, Alemanha). O site é distribuído
            através da Vercel. Alguns destes fornecedores são empresas com sede
            fora da União Europeia; quando exista transferência internacional de
            dados, esta é coberta pelas salvaguardas previstas no RGPD,
            nomeadamente as cláusulas contratuais-tipo aprovadas pela Comissão
            Europeia.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Durante quanto tempo guardamos
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">
                Conta e dados de treino
              </span>{" "}
              — enquanto fores aluno do estúdio. Podes pedir a eliminação da
              conta a qualquer momento.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Registos de pagamento
              </span>{" "}
              — podem ser conservados durante mais tempo, quando necessário para
              o estúdio cumprir obrigações legais e contabilísticas.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Mensagens de contacto
              </span>{" "}
              — guardadas o tempo necessário para tratar o pedido e, depois,
              eliminadas periodicamente.
            </li>
          </ul>
          <p className="mt-3">
            Quando deixam de ser necessários, os dados são eliminados ou
            anonimizados.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Cookies</h2>
          <p className="mt-2">
            Este site usa apenas um cookie essencial: o que mantém a tua sessão
            iniciada depois de entrares na conta. Sem ele, terias de iniciar
            sessão a cada página. Por ser estritamente necessário ao
            funcionamento do site, não depende do teu consentimento e não
            mostramos um aviso de cookies. Não usamos cookies de publicidade, de
            redes sociais nem ferramentas de análise de tráfego. Se isso vier a
            mudar, atualizaremos esta página e pediremos o teu consentimento
            antes de usar quaisquer cookies não essenciais.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. Os teus direitos
          </h2>
          <p className="mt-2">
            Ao abrigo do Regulamento Geral sobre a Proteção de Dados (RGPD), tens
            direito a:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-muted-foreground">
            <li>aceder aos dados que temos sobre ti;</li>
            <li>
              corrigir dados incorretos ou desatualizados — podes fazê-lo
              diretamente no teu Perfil;
            </li>
            <li>pedir a eliminação dos teus dados e da tua conta;</li>
            <li>
              pedir a limitação do tratamento ou opor-te a determinados
              tratamentos;
            </li>
            <li>receber os teus dados num formato portável.</li>
          </ul>
          <p className="mt-3">
            Para exerceres qualquer destes direitos, {reachUs}. Respondemos com
            a maior brevidade possível. Se considerares que os teus dados não
            estão a ser tratados corretamente, podes apresentar reclamação à
            Comissão Nacional de Proteção de Dados (CNPD) — www.cnpd.pt.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">10. Menores</h2>
          <p className="mt-2">
            Este site e as contas destinam-se a maiores de 18 anos. Não
            recolhemos intencionalmente dados de menores através do site. Se um
            menor treina no estúdio, a inscrição e a gestão das marcações são
            feitas pelo respetivo encarregado de educação, responsável pelos
            dados que partilha. Se soubermos que foi criada uma conta por um
            menor sem esse consentimento, procederemos à sua eliminação.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            11. Segurança
          </h2>
          <p className="mt-2">
            Adotamos medidas técnicas e organizativas razoáveis para proteger os
            teus dados: acesso por palavra-passe, ligação encriptada (HTTPS) e
            regras que limitam cada utilizador aos seus próprios dados. Nenhum
            sistema é totalmente infalível, mas comprometemo-nos a tratar os teus
            dados com cuidado.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            12. Alterações a esta política
          </h2>
          <p className="mt-2">
            Podemos atualizar esta política sempre que necessário — por exemplo,
            se acrescentarmos funcionalidades ao site. A data da última
            atualização está no topo da página; alterações significativas serão
            comunicadas de forma visível.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            13. Contacto
          </h2>
          <p className="mt-2">
            Para qualquer questão sobre esta política ou sobre os teus dados
            pessoais, {reachUs}. Consulta também os nossos{" "}
            <Link
              href="/termos"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Termos e Condições
            </Link>
            .
          </p>
        </section>
      </div>
    </section>
  );
}
