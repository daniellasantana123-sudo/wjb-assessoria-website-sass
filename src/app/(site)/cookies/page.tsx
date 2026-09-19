import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Política de Cookies da WJB Assessoria Contábil.",
};

/**
 * WJB_Conteudos_Incompletos_Implementacao_Claude.md, seção 16 — só descreve
 * as categorias de cookies que realmente existem no projeto (essenciais e,
 * quando um provider de analytics for confirmado, de análise). Nenhum
 * cookie de marketing está instalado, por isso essa categoria não aparece.
 */
export default function CookiesPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cookies" }]} />
      <article className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Política de Cookies
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Última atualização: 30 de agosto de 2026
        </p>

        <div className="mt-8 flex flex-col gap-6">
          <p className="text-foreground">
            Cookies são pequenos arquivos ou identificadores utilizados por sites para
            permitir funcionalidades, manter preferências, reforçar segurança ou, quando
            habilitado, compreender o uso das páginas.
          </p>

          <section>
            <h2 className="text-foreground text-lg font-semibold">Categorias possíveis</h2>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <h3 className="text-foreground font-medium">Cookies essenciais</h3>
                <p className="text-foreground mt-1">
                  Necessários para funcionamento, segurança e recursos básicos do site.
                </p>
              </div>
              <div>
                <h3 className="text-foreground font-medium">Cookies de preferências</h3>
                <p className="text-foreground mt-1">
                  Podem guardar escolhas do usuário que melhoram a experiência.
                </p>
              </div>
              <div>
                <h3 className="text-foreground font-medium">Cookies de análise</h3>
                <p className="text-foreground mt-1">
                  Quando utilizados, ajudam a entender de forma agregada como o site é
                  acessado e quais páginas são mais utilizadas.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">Consentimento</h2>
            <p className="text-foreground mt-2">
              Quando houver cookies não essenciais sujeitos a consentimento, o site
              deverá oferecer uma ferramenta para aceitar ou rejeitar preferências.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">
              Como alterar escolhas
            </h2>
            <p className="text-foreground mt-2">
              O usuário poderá alterar preferências pelo gerenciador de cookies
              disponibilizado no site, quando aplicável, ou pelas configurações do
              navegador.
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">Contato</h2>
            <p className="text-foreground mt-2">
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
