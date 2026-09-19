import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";

import { SkipLink } from "@/components/layout/skip-link";
import { CookieConsentBanner } from "@/components/shared/cookie-consent-banner";
import { AnalyticsLoader } from "@/lib/analytics/loader";
import { getSiteUrl } from "@/lib/seo/site-url";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/**
 * Noto Sans Thai (2026-09-17, a pedido do usuário — trocar de novo a fonte
 * do H1 do Hero, antes Oxanium desde 2026-09-14). Mesmo padrão de
 * self-host via `next/font/google` do Inter/Oxanium. `subsets` inclui
 * `latin-ext` além de `latin` — o pacote "latin" puro do Google Fonts não
 * cobre todos os acentos do português (ex.: ê/ã/ç), e o nome da fonte
 * sugere script tailandês, mas o arquivo real cobre os 3 scripts (`latin`,
 * `latin-ext`, `thai`, confirmado em `font-data.json` do pacote `next`
 * antes de usar). Fonte variável (peso 100-900, eixo `wdth` 62.5-100) —
 * sem passar `weight`, o Next carrega o range inteiro; o H1 usa
 * `font-semibold` (600, pedido explícito do usuário) via Tailwind, `wdth`
 * fica no valor default (100), sem precisar de CSS extra.
 */
const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin", "latin-ext"],
});

const siteName = "WJB Assessoria Contábil";
const siteDescription =
  "Contabilidade próxima para decisões melhores. Tecnologia para sua empresa ir mais longe.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: siteName, template: `%s | ${siteName}` },
  description: siteDescription,
  openGraph: {
    title: siteName,
    description: siteDescription,
    siteName,
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/images/og/home.webp", width: 1200, height: 630 }],
  },
};

/**
 * Raiz enxuta de propósito (2026-09-16) — nada aqui usa API dinâmica
 * (`headers()`/`cookies()`), pra não "contaminar" toda rota do site como
 * dinâmica só por causa de uma decisão de chrome. Header/mega menu/rodapé/
 * Assistente Virtual de marketing vivem em `(site)/layout.tsx` (todas as
 * páginas institucionais + `/admin`); `/portal` tem o próprio app shell em
 * `portal/layout.tsx` (sidebar, sem header/footer de marketing). Cada
 * subárvore decide seu próprio chrome — só assim as páginas de marketing
 * continuam estáticas (SSG) no build, como antes.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${notoSansThai.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <noscript>
          <style>{`.js-reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <SkipLink />
        <main id="main-content" className="flex flex-1 flex-col">
          {children}
        </main>
        <CookieConsentBanner />
        <AnalyticsLoader />
      </body>
    </html>
  );
}
