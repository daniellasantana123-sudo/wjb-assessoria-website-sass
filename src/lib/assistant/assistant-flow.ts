import { getServicePage } from "@/config/service-pages";
import { getPlan } from "@/config/plans";
import type { AssistantServiceKey } from "@/types/assistant";

import { assistantPageGreetings, assistantDefaultGreeting } from "./assistant-config";

export interface AssistantServiceResponse {
  /** Texto da resposta - sempre derivado de conteúdo real do projeto. */
  message: string;
  /** Rota para "Conhecer o serviço"/"Ver plano", quando existir. */
  href?: string;
  /** Nome do serviço, usado para pré-preencher o formulário de qualificação. */
  serviceLabel: string;
}

/**
 * Resolve a resposta de cada item do menu a partir do conteúdo já existente
 * (`service-pages.ts`/`plans.ts`) - nunca texto solto hardcoded aqui, exceto
 * para os dois casos sem página de conteúdo própria ("Outros serviços" e o
 * escape hatch "Falar com um especialista").
 */
export function getAssistantServiceResponse(
  key: AssistantServiceKey,
): AssistantServiceResponse | null {
  switch (key) {
    case "abrirEmpresa": {
      const service = getServicePage("abrir-empresa");
      if (!service) return null;
      return {
        message: `${service.shortDescription} A WJB acompanha desde a abertura até a organização fiscal e contábil da sua empresa.`,
        href: `/servicos/${service.slug}`,
        serviceLabel: service.title,
      };
    }
    case "trocarContador": {
      const service = getServicePage("trocar-de-contador");
      if (!service) return null;
      return {
        message: service.shortDescription,
        href: `/servicos/${service.slug}`,
        serviceLabel: service.title,
      };
    }
    case "contabilidadeCompleta": {
      const service = getServicePage("contabilidade-completa");
      if (!service) return null;
      return {
        message: service.shortDescription,
        href: `/servicos/${service.slug}`,
        serviceLabel: service.title,
      };
    }
    case "mei": {
      const plan = getPlan("mei");
      if (!plan) return null;
      return {
        message: plan.cardSummary,
        href: plan.detailsPath,
        serviceLabel: `Plano ${plan.name}`,
      };
    }
    case "departamentoPessoal": {
      const service = getServicePage("departamento-pessoal");
      if (!service) return null;
      return {
        message: service.shortDescription,
        href: `/servicos/${service.slug}`,
        serviceLabel: service.title,
      };
    }
    case "impostosRegularizacao": {
      const service = getServicePage("fiscal-tributario");
      if (!service) return null;
      return {
        message: service.shortDescription,
        href: `/servicos/${service.slug}`,
        serviceLabel: service.title,
      };
    }
    case "consultoria": {
      const service = getServicePage("consultoria-contabil");
      if (!service) return null;
      return {
        message: service.shortDescription,
        href: `/servicos/${service.slug}`,
        serviceLabel: service.title,
      };
    }
    case "outrosServicos":
      return {
        message: "A WJB tem serviços organizados por categoria - contabilidade, fiscal e tributário, departamento pessoal, societário e consultoria.",
        href: "/servicos",
        serviceLabel: "Outros serviços",
      };
    case "especialista":
      return null;
    default:
      return null;
  }
}

/** Saudação contextual (seção "CONTEXTO DA PÁGINA") a partir do caminho atual. */
export function getContextualGreeting(pathname: string): string {
  const match = assistantPageGreetings.find((entry) => pathname.startsWith(entry.pathPrefix));
  return match?.message ?? assistantDefaultGreeting;
}
