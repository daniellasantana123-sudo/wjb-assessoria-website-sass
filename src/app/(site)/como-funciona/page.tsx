import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { headerCtas } from "@/config/navigation";
import { cn, staticCardHoverClass } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Como funciona a WJB | Contabilidade simples e consultiva" },
  description:
    "Entenda como funciona o atendimento da WJB Assessoria Contábil, desde o diagnóstico da empresa até a rotina contábil e o acompanhamento contínuo.",
};

const steps = [
  {
    step: "01",
    title: "Entendemos sua empresa",
    description:
      "Conversamos sobre atividade, estrutura, regime tributário, equipe, operação, dificuldades e objetivos.",
  },
  {
    step: "02",
    title: "Analisamos a situação atual",
    description:
      "Verificamos documentos, obrigações, cadastros, enquadramento e os principais pontos que precisam de atenção.",
  },
  {
    step: "03",
    title: "Organizamos a transição",
    description:
      "Quando houver troca de contador, orientamos a transferência de documentos e informações para reduzir riscos e interrupções.",
  },
  {
    step: "04",
    title: "Estruturamos a rotina",
    description:
      "Definimos o fluxo de documentos, responsabilidades, prazos, canais de atendimento e processos recorrentes.",
  },
  {
    step: "05",
    title: "Cuidamos das obrigações",
    description:
      "Executamos os serviços contratados nas áreas contábil, fiscal, tributária, trabalhista e societária.",
  },
  {
    step: "06",
    title: "Transformamos dados em orientação",
    description:
      "Sempre que aplicável, apresentamos informações e alertas que ajudam o empresário a entender melhor sua operação.",
  },
  {
    step: "07",
    title: "Acompanhamos a evolução",
    description:
      "A empresa muda, e a contabilidade precisa acompanhar. Revisamos necessidades e apoiamos novos momentos do negócio.",
  },
];

export default function HowItWorksPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Como Funciona" }]} />
      <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
        Uma rotina contábil organizada, com acompanhamento de verdade.
      </h1>
      <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
        Nosso processo foi pensado para reduzir burocracia, organizar informações e
        manter você informado sobre o que realmente importa para sua empresa.
      </p>

      <RevealStagger
        as="ol"
        itemAs="li"
        className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2"
        itemClassName="h-full"
      >
        {steps.map((item) => (
          <div
            key={item.step}
            className={cn(
              staticCardHoverClass,
              "border-border bg-background flex h-full flex-col gap-2 rounded-md border p-5",
            )}
          >
            <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
              {item.step.replace(/^0/, "")}
            </span>
            <h2 className="text-foreground font-medium">{item.title}</h2>
            <p className="text-muted-foreground text-sm">{item.description}</p>
          </div>
        ))}
      </RevealStagger>

      <div className="mt-12 flex justify-center">
        <Link
          href={headerCtas.talkToAccountant.href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "cta" })}
        >
          Quero conversar sobre minha empresa
        </Link>
      </div>
    </Container>
  );
}
