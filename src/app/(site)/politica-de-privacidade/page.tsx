import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de Privacidade da WJB Assessoria Contábil.",
};

/**
 * Minuta operacional para publicação inicial (WJB_Conteudos_Incompletos...md,
 * seção 14) — recomenda-se revisão jurídica antes da versão definitiva,
 * especialmente após a definição de analytics, CRM, formulários, cookies e
 * provedores terceirizados (nenhum confirmado ainda, seção 36).
 */
export default function PrivacyPolicyPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Política de Privacidade" }]}
      />
      <article className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Política de Privacidade
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Última atualização: 30 de agosto de 2026
        </p>

        <div className="mt-8 flex flex-col gap-6">
          <p className="text-foreground">
            A WJB Assessoria Contábil, inscrita no CNPJ nº {siteConfig.company.cnpj},
            respeita a privacidade dos usuários e clientes e busca tratar dados pessoais
            de forma responsável, transparente e segura, em conformidade com a legislação
            aplicável, incluindo a Lei Geral de Proteção de Dados Pessoais - LGPD (Lei nº
            13.709/2018).
          </p>

          <section>
            <h2 className="text-foreground text-lg font-semibold">
              1. Dados que podem ser coletados
            </h2>
            <p className="text-foreground mt-2">
              Podemos receber dados informados diretamente por você em formulários,
              contatos por e-mail, telefone ou WhatsApp, incluindo nome, e-mail, telefone,
              empresa, CNPJ e conteúdo de mensagens.
            </p>
            <p className="text-foreground mt-2">
              O site também poderá registrar informações técnicas necessárias para seu
              funcionamento e segurança, como endereço IP, tipo de dispositivo, navegador,
              data e horário de acesso.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">
              2. Para que usamos os dados
            </h2>
            <p className="text-foreground mt-2">Os dados poderão ser utilizados para:</p>
            <ul className="text-foreground mt-2 list-disc space-y-1 pl-5">
              <li>responder solicitações e contatos;</li>
              <li>preparar propostas comerciais;</li>
              <li>prestar serviços contratados;</li>
              <li>manter comunicação com clientes;</li>
              <li>cumprir obrigações legais e regulatórias;</li>
              <li>proteger o site, sistemas e usuários;</li>
              <li>
                melhorar processos e experiência digital, quando houver base legal
                aplicável.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">3. Compartilhamento</h2>
            <p className="text-foreground mt-2">A WJB não comercializa dados pessoais.</p>
            <p className="text-foreground mt-2">
              Dados poderão ser compartilhados com fornecedores e operadores estritamente
              necessários à prestação dos serviços, hospedagem, comunicação, segurança,
              tecnologia ou cumprimento de obrigações legais, observados os requisitos
              aplicáveis de proteção de dados.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">4. Cookies</h2>
            <p className="text-foreground mt-2">
              O site poderá utilizar cookies essenciais para funcionamento e, quando
              habilitados, cookies adicionais para medição de audiência ou melhoria da
              experiência.
            </p>
            <p className="text-foreground mt-2">
              Cookies não essenciais devem depender das escolhas do usuário quando exigido
              pela legislação aplicável.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">
              5. Armazenamento e segurança
            </h2>
            <p className="text-foreground mt-2">
              Adotamos medidas técnicas e organizacionais razoáveis para reduzir riscos de
              acesso não autorizado, perda, alteração ou uso inadequado dos dados.
            </p>
            <p className="text-foreground mt-2">
              Nenhum ambiente digital é totalmente isento de riscos, por isso os processos
              de segurança devem ser continuamente revisados.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">
              6. Direitos dos titulares
            </h2>
            <p className="text-foreground mt-2">
              Nos termos da LGPD, o titular poderá solicitar, quando aplicável:
            </p>
            <ul className="text-foreground mt-2 list-disc space-y-1 pl-5">
              <li>confirmação da existência de tratamento;</li>
              <li>acesso aos dados;</li>
              <li>correção de dados incompletos ou desatualizados;</li>
              <li>informações sobre compartilhamento;</li>
              <li>anonimização, bloqueio ou eliminação nos casos previstos em lei;</li>
              <li>revogação do consentimento quando essa for a base utilizada;</li>
              <li>demais direitos previstos na legislação.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">
              7. Contato sobre privacidade
            </h2>
            <p className="text-foreground mt-2">
              Solicitações relacionadas a privacidade e proteção de dados podem ser
              enviadas para:
            </p>
            <p className="text-foreground mt-2">
              E-mail:{" "}
              <a href={`mailto:${siteConfig.contact.email}`} className="hover:underline">
                {siteConfig.contact.email}
              </a>
              <br />
              WJB Assessoria Contábil
              <br />
              CNPJ: {siteConfig.company.cnpj}
              <br />
              Endereço: {siteConfig.address.full}
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">8. Atualizações</h2>
            <p className="text-foreground mt-2">
              Esta política poderá ser atualizada para refletir mudanças legais,
              operacionais ou tecnológicas. A versão vigente deverá permanecer disponível
              nesta página com a data de atualização.
            </p>
          </section>
        </div>
      </article>
    </Container>
  );
}
