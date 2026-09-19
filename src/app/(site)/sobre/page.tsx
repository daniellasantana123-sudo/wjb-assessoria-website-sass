import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Award,
  Check,
  Compass,
  HandCoins,
  HeartHandshake,
  Lightbulb,
  MonitorSmartphone,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { SectionHeading } from "@/components/sections/section-heading";
import { RevealOnScroll, RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { aboutImage, aboutOfficeImage, armelxImages, teamImages } from "@/config/images";
import { headerCtas } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn, staticCardHoverClass } from "@/lib/utils";

export const metadata: Metadata = {
  title: {
    absolute: "Sobre a WJB Assessoria Contábil | Contabilidade e Consultoria",
  },
  description:
    "Conheça a WJB Assessoria Contábil, escritório em São Paulo com atendimento consultivo, soluções contábeis, fiscais, tributárias, trabalhistas e apoio tecnológico para empresas.",
};

/** Cada card corresponde a uma das 3 frases do título da seção (mesmo texto do doc mestre, só redistribuído). */
const purposeCards = [
  {
    title: "Pessoas em primeiro lugar",
    description:
      "Acreditamos que a contabilidade tem impacto direto na vida das pessoas. Empresas organizadas geram empregos, sustentam famílias, movimentam a economia e criam novas oportunidades.",
    icon: Users,
  },
  {
    title: "Clareza para decidir",
    description:
      "Usamos o conhecimento contábil, fiscal e tributário para reduzir riscos, evitar pagamentos indevidos e transformar informações complexas em decisões mais simples e conscientes.",
    icon: Compass,
  },
  {
    title: "Excelência para crescer",
    description:
      "Cuidar bem da contabilidade de uma empresa também significa cuidar do patrimônio, do tempo e da tranquilidade de quem está por trás dela.",
    icon: Award,
  },
];

const howWeActCards = [
  {
    title: "Atendimento humano e consultivo",
    description:
      "Você fala com pessoas que entendem o seu negócio e acompanham suas necessidades de forma próxima e responsável.",
    icon: HeartHandshake,
  },
  {
    title: "Informação que ajuda a decidir",
    description:
      "Traduzimos números, regras e obrigações em orientações claras para que o empresário saiba o que está acontecendo e quais caminhos pode seguir.",
    icon: Lightbulb,
  },
  {
    title: "Qualidade em cada entrega",
    description:
      "Trabalhamos com organização, atualização técnica e revisão dos processos para manter a empresa regular e reduzir riscos.",
    icon: ShieldCheck,
  },
  {
    title: "Pagar corretamente, sem pagar além do necessário",
    description:
      "Avaliamos enquadramentos, oportunidades e riscos para que os tributos sejam tratados de acordo com a legislação e a realidade do negócio.",
    icon: HandCoins,
  },
  {
    title: "Contabilidade conectada ao presente",
    description:
      "Utilizamos recursos digitais para melhorar comunicação, organização de documentos, acompanhamento e eficiência operacional.",
    icon: MonitorSmartphone,
  },
  {
    title: "Crescimento construído em conjunto",
    description:
      "A relação com o cliente não termina na entrega de uma obrigação. Nosso objetivo é acompanhar a evolução da empresa e contribuir para decisões mais seguras.",
    icon: TrendingUp,
  },
];

const armelxHighlights = [
  "Automação de processos empresariais",
  "Integração de sistemas e APIs",
  "Dashboards e dados para gestão",
  "Soluções digitais sob medida",
  "Inteligência artificial aplicada a processos",
  "Cloud, infraestrutura e DevOps",
  "UX, produto e transformação digital",
];

/**
 * Divide o texto real que já existia em 2 parágrafos corridos (2026-09-18,
 * "layout/composição das seções" — mesmo achado da Home: essa seção era
 * uma cópia pixel-a-pixel de "WJB + Armel-x" logo acima, sem nada que as
 * diferenciasse). O segundo parágrafo original já contrastava "digital" e
 * "consultivo" — vira 2 cards em vez de texto corrido, mesmo padrão de
 * `HumanPlusTech` da Home. Nenhum fato novo, só o texto já aprovado
 * reorganizado.
 */
const attendanceHighlights = [
  {
    title: "Atendimento digital",
    description:
      "Troca organizada de informações e documentos, com comunicação clara em cada etapa.",
    icon: MonitorSmartphone,
  },
  {
    title: "Acompanhamento consultivo",
    description:
      "Suporte consultivo conforme a necessidade de cada cliente, em qualquer momento da empresa.",
    icon: HeartHandshake,
  },
];

/** WJB_Conteudos_Incompletos_Implementacao_Claude.md + ajuste do usuário em 2026-08-31. */
const teamMembers = [
  {
    name: "Daniella Santana",
    roleLines: ["CEO, Founder", "Contadora"],
    image: teamImages.daniellaSantana,
  },
  {
    name: "Diego Júlio de Barros",
    roleLines: ["Cofundador", "Diretor do Departamento Fiscal"],
    image: teamImages.diegoJulioDeBarros,
  },
];

export default function AboutPage() {
  return (
    <>
      <Container className="py-12 sm:py-16">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Sobre" }]} />

        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div>
            <p className="text-primary text-sm font-medium tracking-wide uppercase">
              Sobre a WJB
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Contabilidade para cuidar da empresa e das pessoas que constroem o negócio.
            </h1>
            <div className="text-muted-foreground mt-4 flex max-w-2xl flex-col gap-3 text-lg">
              <p>
                A WJB Assessoria Contábil combina conhecimento técnico, atendimento
                próximo e tecnologia para ajudar empresas a manterem suas obrigações em
                dia, tomarem decisões com mais clareza e crescerem com segurança.
              </p>
              <p>
                Nosso trabalho vai além do cumprimento de rotinas contábeis. Buscamos
                compreender a realidade de cada negócio, antecipar riscos, organizar
                informações e orientar o empresário para que ele possa decidir melhor.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={headerCtas.talkToAccountant.href}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "cta" })}
              >
                {headerCtas.talkToAccountant.label}
              </Link>
              <Link href="/servicos" className={buttonVariants({ variant: "outline" })}>
                Conhecer nossos serviços
              </Link>
            </div>
          </div>

          <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px]">
            <Image
              src={aboutImage.src}
              alt={aboutImage.alt}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </div>
        </div>
      </Container>

      <RevealOnScroll as="section" className="border-border bg-muted/30 border-y">
        <Container className="py-16 sm:py-20">
          <SectionHeading title="Pessoas em primeiro lugar. Clareza para decidir. Excelência para crescer." />
          <RevealStagger
            className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3"
            itemClassName="h-full"
          >
            {purposeCards.map((card) => (
              <div
                key={card.title}
                className={cn(
                  staticCardHoverClass,
                  "border-border bg-background flex h-full flex-col gap-3 rounded-md border p-5",
                )}
              >
                <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md">
                  <card.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="text-foreground font-medium">{card.title}</span>
                <span className="text-muted-foreground text-sm">{card.description}</span>
              </div>
            ))}
          </RevealStagger>
        </Container>
      </RevealOnScroll>

      <RevealOnScroll as="section" className="border-border border-b">
        <Container className="py-16 sm:py-20">
          <SectionHeading title="Como atuamos" />
          <RevealStagger
            className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            itemClassName="h-full"
          >
            {howWeActCards.map((card) => (
              <div
                key={card.title}
                className={cn(
                  staticCardHoverClass,
                  "border-border flex h-full flex-col gap-3 rounded-md border p-5",
                )}
              >
                <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md">
                  <card.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="text-foreground font-medium">{card.title}</span>
                <span className="text-muted-foreground text-sm">{card.description}</span>
              </div>
            ))}
          </RevealStagger>
        </Container>
      </RevealOnScroll>

      <RevealOnScroll as="section" className="border-border bg-muted/30 border-b">
        <Container className="py-16 sm:py-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div>
              <SectionHeading
                align="left"
                eyebrow="WJB + Armel-x Tecnologia"
                title="Quando contabilidade e tecnologia trabalham juntas, a gestão fica mais simples."
              />
              <p className="text-muted-foreground mt-6 max-w-xl text-lg">
                A WJB Assessoria Contábil atua em parceria com a Armel-x Tecnologia para
                aproximar contabilidade, processos digitais, automação, dados e soluções
                de software.
                <br />
                <br />
                Essa integração amplia a capacidade de apoiar empresas que precisam
                organizar rotinas, conectar sistemas, automatizar processos e
                transformar dados em informações úteis para a gestão.
              </p>
            </div>

            <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px]">
              <Image
                src={armelxImages.automation.src}
                alt={armelxImages.automation.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
            </div>
          </div>

          <RevealStagger
            as="ul"
            itemAs="li"
            className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {armelxHighlights.map((item) => (
              <div
                key={item}
                className="border-border bg-background flex items-start gap-2 rounded-md border p-4 text-sm"
              >
                <Check aria-hidden="true" className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-foreground">{item}</span>
              </div>
            ))}
          </RevealStagger>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={siteConfig.partners.armelx.website}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "primary" })}
            >
              Conhecer a Armel-x Tecnologia
            </a>
            <Link href="/solucoes" className={buttonVariants({ variant: "outline" })}>
              Conhecer nossas soluções
            </Link>
          </div>
        </Container>
      </RevealOnScroll>

      {/*
       * Restruturada (2026-09-18, "layout/composição das seções"): antes
       * era uma cópia pixel-a-pixel da seção "WJB + Armel-x" logo acima
       * (mesmo esqueleto imagem+texto, nada a mais). O parágrafo original
       * já contrastava atendimento "digital" e "consultivo" — vira 2 cards
       * (`attendanceHighlights`, mesmo padrão do `HumanPlusTech` da Home)
       * em vez de texto corrido, diferenciando a seção das duas vizinhas.
       */}
      <RevealOnScroll as="section" className="border-border bg-primary/5 border-b">
        <Container className="py-16 sm:py-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px] lg:order-2">
              <Image
                src={aboutOfficeImage.src}
                alt={aboutOfficeImage.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
            </div>
            <div className="lg:order-1">
              <SectionHeading
                align="left"
                title="Um escritório preparado para atender empresas em diferentes momentos."
                description="Atendemos empresas que estão começando, negócios em crescimento e organizações que precisam reorganizar processos contábeis, fiscais, tributários, societários ou trabalhistas."
              />
              <RevealStagger className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" itemClassName="h-full">
                {attendanceHighlights.map((item) => (
                  <div
                    key={item.title}
                    className={cn(
                      staticCardHoverClass,
                      "border-border bg-background h-full rounded-md border p-4",
                    )}
                  >
                    <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-md">
                      <item.icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <p className="text-foreground mt-2 text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
                  </div>
                ))}
              </RevealStagger>
            </div>
          </div>
        </Container>
      </RevealOnScroll>

      <RevealOnScroll as="section" className="border-border bg-muted/30 border-b">
        <Container className="py-16 sm:py-20">
          <SectionHeading
            title="Especialistas trabalhando para dar segurança ao seu negócio."
            description="Nossa atuação reúne conhecimento contábil, fiscal, tributário, trabalhista e societário, com foco em atendimento responsável, atualização técnica e orientação prática para o empresário."
          />
          <RevealStagger className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-8 sm:grid-cols-2">
            {teamMembers.map((member) => (
              <div key={member.name} className="flex flex-col items-center gap-4 text-center">
                <div className="group relative aspect-[4/5] w-40 overflow-hidden rounded-[10px] sm:w-48">
                  <Image
                    src={member.image.src}
                    alt={member.image.alt}
                    fill
                    sizes="192px"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                </div>
                <div>
                  <p className="text-foreground font-medium">{member.name}</p>
                  {member.roleLines.map((line) => (
                    <p key={line} className="text-muted-foreground text-sm">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </RevealStagger>
        </Container>
      </RevealOnScroll>

      <RevealOnScroll as="section">
        <Container className="flex flex-col items-center gap-6 py-16 text-center sm:py-20">
          <SectionHeading title="Quer uma contabilidade mais próxima da realidade da sua empresa?" />
          <p className="text-muted-foreground max-w-xl">
            Converse com a WJB e entenda como podemos apoiar sua empresa com organização,
            clareza e acompanhamento contábil.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={headerCtas.talkToAccountant.href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "cta" })}
            >
              {headerCtas.talkToAccountant.label}
            </Link>
            <Link
              href={headerCtas.requestProposal.href}
              className={buttonVariants({ variant: "outline" })}
            >
              {headerCtas.requestProposal.label}
            </Link>
          </div>
        </Container>
      </RevealOnScroll>
    </>
  );
}
