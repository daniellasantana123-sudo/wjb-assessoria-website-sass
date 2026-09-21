import type { AssistantServiceKey } from "@/types/assistant";

export interface AssistantMenuOption {
  key: AssistantServiceKey;
  label: string;
}

/**
 * Menu principal do assistente. Cada item mapeia para uma chave resolvida
 * em `assistant-flow.ts` a partir de conteúdo que já existe no projeto
 * (`service-pages.ts`/`plans.ts`) - nenhum serviço ou página é inventado.
 */
export const assistantMenuOptions: AssistantMenuOption[] = [
  { key: "abrirEmpresa", label: "Abrir minha empresa" },
  { key: "trocarContador", label: "Trocar de contador" },
  { key: "contabilidadeCompleta", label: "Contabilidade para minha empresa" },
  { key: "mei", label: "MEI" },
  { key: "departamentoPessoal", label: "Departamento pessoal / Folha" },
  { key: "impostosRegularizacao", label: "Impostos e regularização" },
  { key: "consultoria", label: "Consultoria contábil e tributária" },
  { key: "outrosServicos", label: "Outros serviços" },
  { key: "especialista", label: "Falar com um especialista" },
];

/**
 * Resolve cada chave do menu para onde ela aponta de fato no projeto -
 * slug de `service-pages.ts`, id de `plans.ts`, uma rota real, ou o
 * "escape hatch" direto pro WhatsApp (seção "ESCAPE HATCH").
 */
export type AssistantTarget =
  | { kind: "service"; slug: string }
  | { kind: "plan"; id: "mei" | "simples" | "presumido" }
  | { kind: "route"; href: string }
  | { kind: "whatsapp" };

export const assistantServiceTargets: Record<AssistantServiceKey, AssistantTarget> = {
  abrirEmpresa: { kind: "service", slug: "abrir-empresa" },
  trocarContador: { kind: "service", slug: "trocar-de-contador" },
  contabilidadeCompleta: { kind: "service", slug: "contabilidade-completa" },
  mei: { kind: "plan", id: "mei" },
  departamentoPessoal: { kind: "service", slug: "departamento-pessoal" },
  impostosRegularizacao: { kind: "service", slug: "fiscal-tributario" },
  consultoria: { kind: "service", slug: "consultoria-contabil" },
  outrosServicos: { kind: "route", href: "/servicos" },
  especialista: { kind: "whatsapp" },
};

/**
 * Saudação contextual por página (seção "CONTEXTO DA PÁGINA") - prefixo de
 * rota -> texto. Resolvida por `assistant-flow.ts`, nunca hardcoded em
 * componente. Cai na saudação padrão quando nenhum prefixo bate.
 */
export const assistantPageGreetings: { pathPrefix: string; message: string }[] = [
  {
    pathPrefix: "/servicos/abrir-empresa",
    message:
      "Vi que você está conhecendo o serviço de abertura de empresas. Posso ajudar com alguma dúvida ou encaminhar você para um especialista.",
  },
  {
    pathPrefix: "/servicos/trocar-de-contador",
    message:
      "Vi que você está conhecendo o serviço de troca de contador. Posso ajudar com alguma dúvida ou encaminhar você para um especialista.",
  },
  {
    pathPrefix: "/planos",
    message:
      "Vi que você está conhecendo os planos da WJB. Posso ajudar com alguma dúvida ou encaminhar você para um especialista.",
  },
  {
    pathPrefix: "/contabilidade-digital",
    message:
      "Vi que você está conhecendo a Contabilidade Digital da WJB. Posso ajudar com alguma dúvida ou encaminhar você para um especialista.",
  },
];

export const assistantDefaultGreeting =
  "Olá! 👋 Bem-vindo à WJB. Posso ajudar você a encontrar a solução contábil ideal para sua empresa.";
