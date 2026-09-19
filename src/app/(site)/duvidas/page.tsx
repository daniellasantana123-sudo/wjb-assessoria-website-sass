import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Faq } from "@/components/sections/faq";
import { RevealOnScroll } from "@/components/shared/reveal-on-scroll";

export const metadata: Metadata = {
  title: "Dúvidas",
  description: "Perguntas frequentes sobre a WJB Assessoria Contábil.",
};

export default function FaqPage() {
  return (
    <>
      <Container className="pt-12 sm:pt-16">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Dúvidas" }]} />
      </Container>
      {/* Mesmo `Faq` da Home (accordion já bem animado, não tocado) — só
          ganha a entrada padrão, que na Home já vem do `RevealOnScroll`
          em page.tsx e aqui não existia. */}
      <RevealOnScroll>
        <Faq />
      </RevealOnScroll>
    </>
  );
}
