import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos de Uso da WJB Assessoria Contábil.",
};

/**
 * Minuta operacional para publicação inicial (WJB_Conteudos_Incompletos...md,
 * seção 15) — recomenda-se revisão jurídica antes da versão definitiva.
 */
export default function TermsPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Termos de Uso" }]} />
      <article className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Termos de Uso
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Última atualização: 30 de agosto de 2026
        </p>

        <div className="mt-8 flex flex-col gap-6">
          <p className="text-foreground">
            Ao acessar o site da WJB Assessoria Contábil, você concorda em utilizá-lo de
            forma lícita e compatível com estes Termos.
          </p>

          <section>
            <h2 className="text-foreground text-lg font-semibold">
              1. Finalidade do site
            </h2>
            <p className="text-foreground mt-2">
              O site apresenta informações institucionais, conteúdos, serviços e canais
              de contato da WJB Assessoria Contábil.
            </p>
            <p className="text-foreground mt-2">
              O conteúdo publicado possui caráter informativo geral e não substitui
              análise contábil, fiscal, tributária, trabalhista, societária ou jurídica
              específica para cada caso.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">
              2. Solicitações e propostas
            </h2>
            <p className="text-foreground mt-2">
              O envio de formulários, mensagens ou pedidos de orçamento não constitui
              automaticamente contratação de serviços.
            </p>
            <p className="text-foreground mt-2">
              A contratação ocorre após definição de escopo, responsabilidades, valores
              e formalização entre as partes.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">3. Conteúdo</h2>
            <p className="text-foreground mt-2">
              A WJB busca manter as informações do site atualizadas, mas regras
              tributárias, fiscais, trabalhistas e regulatórias podem mudar.
            </p>
            <p className="text-foreground mt-2">
              Antes de tomar decisões com impacto financeiro ou legal, o usuário deve
              solicitar análise específica da sua situação.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">
              4. Propriedade intelectual
            </h2>
            <p className="text-foreground mt-2">
              Textos, identidade visual, elementos gráficos e demais materiais próprios
              da WJB não podem ser reproduzidos para fins comerciais sem autorização,
              salvo nos limites permitidos pela legislação.
            </p>
            <p className="text-foreground mt-2">
              Marcas e conteúdos de terceiros permanecem pertencentes aos respectivos
              titulares.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">5. Links externos</h2>
            <p className="text-foreground mt-2">
              O site poderá conter links para plataformas de terceiros, inclusive
              WhatsApp e sites parceiros. A WJB não controla as políticas,
              disponibilidade ou conteúdo desses ambientes externos.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">6. Disponibilidade</h2>
            <p className="text-foreground mt-2">
              Podem ocorrer interrupções temporárias por manutenção, falhas técnicas,
              atualizações ou fatores externos.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">7. Privacidade</h2>
            <p className="text-foreground mt-2">
              O tratamento de dados pessoais relacionado ao site é explicado na
              Política de Privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">8. Contato</h2>
            <p className="text-foreground mt-2">
              Dúvidas sobre estes Termos podem ser enviadas para:{" "}
              <a href={`mailto:${siteConfig.contact.email}`} className="hover:underline">
                {siteConfig.contact.email}
              </a>
            </p>
          </section>
        </div>
      </article>
    </Container>
  );
}
