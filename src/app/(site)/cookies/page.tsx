import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { CookiePreferencesButton } from "@/components/shared/cookie-preferences-button";
import { getActiveMeasurementServices } from "@/config/analytics";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  alternates: { canonical: "/cookies" },
  title: "Cookies",
  description: "Política de Cookies da WJB Assessoria Contábil: quais categorias de cookies o site pode usar, como funciona o seu consentimento e como falar com a nossa equipe.",
};

/**
 * WJB_Conteudos_Incompletos_Implementacao_Claude.md, seção 16 — só descreve
 * as categorias de cookies que realmente existem no projeto.
 */
/*
 * Fase 6 do plano comercial (2026-11-10): as seções sobre Google Analytics e
 * Google Ads só aparecem quando o contêiner do GTM está configurado
 * (`src/config/analytics.ts`) - antes disso o site não usa esses cookies e
 * dizer o contrário seria falso. Texto operacional; revisão jurídica
 * recomendada, como nas demais páginas legais.
 */
export default function CookiesPage() {
  const services = getActiveMeasurementServices();
  const measurementActive = services.googleAnalytics || services.googleAds;
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
                  {services.googleAnalytics
                    ? " Usamos o Google Analytics, do Google, para esse fim."
                    : null}
                </p>
              </div>
              {services.googleAds ? (
                <div>
                  <h3 className="text-foreground font-medium">Cookies de publicidade</h3>
                  <p className="text-foreground mt-1">
                    Usamos o Google Ads, do Google, para medir quais anúncios levam
                    pessoas a entrar em contato com a WJB e para exibir nossos anúncios
                    a quem já visitou o site. Nenhum dado que identifique você, como
                    nome, e-mail ou telefone, é enviado nesses cookies.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">Consentimento</h2>
            <p className="text-foreground mt-2">
              {measurementActive
                ? "Cookies de análise e de publicidade (quando usados) só são ativados depois que você clica em \"Aceitar todos\" no aviso de cookies. Se você recusar, nenhum deles é usado."
                : "Quando houver cookies não essenciais sujeitos a consentimento, o site deverá oferecer uma ferramenta para aceitar ou rejeitar preferências."}
            </p>
          </section>

          <section>
            <h2 className="text-foreground text-lg font-semibold">
              Como alterar escolhas
            </h2>
            <p className="text-foreground mt-2">
              Você pode rever sua escolha a qualquer momento pelo botão abaixo (também
              disponível no rodapé de todas as páginas) ou pelas configurações do
              navegador. Ao retirar o consentimento, os cookies do Google gravados
              pelo site são apagados.
            </p>
            <CookiePreferencesButton className="text-primary mt-3 font-medium underline" />
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
