import type { Metadata } from "next";
import Image from "next/image";
import {
  BarChart3,
  Bot,
  Cloud,
  Code2,
  Megaphone,
  Palette,
  PenTool,
  Rocket,
  Search,
  ShieldCheck,
  Smartphone,
  TrendingUp,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { RevealOnScroll, RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { armelxImages } from "@/config/images";
import { siteConfig } from "@/config/site";
import { getArmelxWhatsAppLink } from "@/integrations/whatsapp";
import { cn, staticCardHoverClass } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Armel-x Tecnologia",
  description: "A parceria entre a WJB Assessoria Contábil e a Armel-x Tecnologia.",
  openGraph: {
    images: [{ url: "/images/og/armelx.webp", width: 1200, height: 630 }],
  },
};

/**
 * WJB_Conteudos_Incompletos_Implementacao_Claude.md, seção 10 (8 primeiros
 * itens). Os 4 últimos (Marketing/Growth, Branding/Design, SEO/Performance,
 * Inbound/Social) vieram de
 * `WJB_Armelx_Adicionar_4_Servicos_Marketing_Design_Growth_Claude.md`
 * (2026-09-14) — mesmo objeto `{ title, description, icon }`, reutilizando
 * o componente de card já existente logo abaixo (nenhum componente novo,
 * nenhuma mudança de grid: `sm:grid-cols-2 lg:grid-cols-4` já rende 12
 * cards como 4 colunas x 3 linhas no desktop sem precisar tocar em CSS).
 */
const armelxAreas = [
  {
    title: "Desenvolvimento de Software",
    description: "Sistemas corporativos, portais e plataformas sob medida.",
    icon: Code2,
  },
  {
    title: "Aplicativos Mobile",
    description: "Aplicativos para Android, iOS e experiências móveis.",
    icon: Smartphone,
  },
  {
    title: "UX Strategy e Product Design",
    description: "Pesquisa, arquitetura da informação, prototipação e design de produto.",
    icon: PenTool,
  },
  {
    title: "Inteligência Artificial e Automação",
    description: "Automação de tarefas e uso responsável de IA em processos empresariais.",
    icon: Bot,
  },
  {
    title: "Dados e Analytics",
    description: "Organização de dados, indicadores e dashboards para apoiar decisões.",
    icon: BarChart3,
  },
  {
    title: "Cloud e DevOps",
    description: "Infraestrutura, automação, deploy, observabilidade e escalabilidade.",
    icon: Cloud,
  },
  {
    title: "Cibersegurança e LGPD",
    description: "Boas práticas de segurança, privacidade e proteção de aplicações.",
    icon: ShieldCheck,
  },
  {
    title: "Consultoria e Transformação Digital",
    description: "Diagnóstico, priorização e roadmap para evolução tecnológica.",
    icon: Rocket,
  },
  {
    title: "Marketing Digital e Growth",
    description:
      "Estratégias de aquisição, conversão e crescimento para ampliar resultados e acelerar negócios.",
    icon: TrendingUp,
  },
  {
    title: "Branding, Design e Conteúdo",
    description:
      "Identidade visual, design gráfico e conteúdo estratégico para fortalecer marcas e comunicação.",
    icon: Palette,
  },
  {
    title: "SEO, Tráfego Pago e Performance",
    description:
      "SEO, mídia paga e otimização contínua para aumentar alcance, tráfego qualificado e conversões.",
    icon: Search,
  },
  {
    title: "Inbound, Social e Automação",
    description:
      "Conteúdo, redes sociais, e-mail e automações para nutrir relacionamentos e gerar oportunidades.",
    icon: Megaphone,
  },
];

/**
 * 6 fotos (2026-09-14, era 3 — usuário pediu pra acrescentar mais 3 "seguindo
 * o mesmo padrão"). Grid `sm:grid-cols-3` já vira 2 linhas de 3 sozinho, sem
 * precisar mudar CSS.
 */
const supportingImages = [
  { ...armelxImages.automation, label: "Automação e integrações" },
  { ...armelxImages.dashboards, label: "Dados e dashboards" },
  { ...armelxImages.cloud, label: "Cloud, DevOps e software" },
  { ...armelxImages.softwareDevelopment, label: "Desenvolvimento de Software" },
  { ...armelxImages.mobileApps, label: "Aplicativos Mobile" },
  { ...armelxImages.uxProductDesign, label: "UX Strategy e Product Design" },
];

export default function ArmelxPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Armel-x Tecnologia" }]}
      />

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div>
          <p className="text-primary text-sm font-medium tracking-wide uppercase">
            WJB + Armel-x
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Tecnologia que transforma processos em vantagem operacional.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
            Por meio da parceria com a Armel-x Tecnologia, clientes e empresas do
            ecossistema WJB podem acessar soluções digitais que complementam a gestão
            contábil e empresarial. A Armel-x desenvolve softwares, produtos digitais,
            automações, experiências e infraestrutura tecnológica orientados a problemas
            reais de negócio.
          </p>
        </div>

        <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px]">
          <Image
            src={armelxImages.hero.src}
            alt={armelxImages.hero.alt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </div>
      </div>

      <RevealStagger className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {supportingImages.map((item) => (
          <div key={item.src}>
            <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px]">
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(min-width: 640px) 33vw, 100vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
            </div>
            <p className="text-muted-foreground mt-2 text-sm font-medium">{item.label}</p>
          </div>
        ))}
      </RevealStagger>

      <RevealOnScroll as="section" className="border-border mt-12 border-t pt-8">
        <h2 className="text-foreground text-lg font-semibold">Áreas de atuação</h2>
        <RevealStagger
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          itemClassName="h-full"
        >
          {armelxAreas.map((area) => (
            <div
              key={area.title}
              className={cn(
                staticCardHoverClass,
                "border-border flex h-full flex-col gap-2 rounded-md border p-5",
              )}
            >
              <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md">
                <area.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="text-foreground font-medium">{area.title}</span>
              <span className="text-muted-foreground text-sm">{area.description}</span>
            </div>
          ))}
        </RevealStagger>
      </RevealOnScroll>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <a
          href={siteConfig.partners.armelx.website}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "primary" })}
        >
          Conhecer a Armel-x Tecnologia
        </a>
        <a
          href={getArmelxWhatsAppLink()!}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          Conversar sobre uma solução
        </a>
      </div>
    </Container>
  );
}
