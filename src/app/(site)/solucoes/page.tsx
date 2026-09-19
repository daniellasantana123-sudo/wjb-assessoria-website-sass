import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { cn, navigableCardClass } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Soluções",
  description:
    "As soluções da WJB Assessoria Contábil: serviços contábeis, Contabilidade Digital e a parceria com a Armel-x Tecnologia.",
};

const solutions = [
  {
    title: "Serviços contábeis",
    description:
      "Contabilidade, fiscal e tributário, departamento pessoal, societário e legalização, e consultoria.",
    href: "/servicos",
  },
  {
    title: "Contabilidade Digital",
    description:
      "Organização digital de documentos, guias e obrigações, com suporte humano.",
    href: "/contabilidade-digital",
  },
  {
    title: "Armel-x Tecnologia",
    description: "Parceria tecnológica da WJB para levar tecnologia à contabilidade.",
    href: "/armel-x-tecnologia",
  },
];

export default function SolutionsPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Soluções" }]} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Soluções</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
        Contabilidade, tecnologia e organização, reunidas para sua empresa ir mais longe.
      </p>

      <RevealStagger className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {solutions.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(navigableCardClass, "block h-full p-5")}
          >
            <h2 className="text-foreground font-medium">{item.title}</h2>
            <p className="text-muted-foreground mt-2 text-sm">{item.description}</p>
          </Link>
        ))}
      </RevealStagger>
    </Container>
  );
}
