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
  { key: "contabilidadeDigital", label: "Contabilidade Digital" },
  { key: "mei", label: "MEI" },
  { key: "departamentoPessoal", label: "Departamento pessoal / Folha" },
  { key: "impostosRegularizacao", label: "Impostos e regularização" },
  { key: "consultoria", label: "Consultoria contábil e tributária" },
  { key: "duvidasFrequentes", label: "Dúvidas frequentes" },
  { key: "outrosServicos", label: "Outros serviços" },
  { key: "especialista", label: "Falar com um especialista" },
];

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
  {
    pathPrefix: "/duvidas",
    message:
      "Vi que você está na página de dúvidas frequentes. Se não encontrou a resposta que procurava, posso te ajudar por aqui ou te encaminhar para um especialista.",
  },
];

export const assistantDefaultGreeting =
  "Oi! Eu sou a Bia 👋, assistente virtual da WJB. Posso ajudar você a encontrar a solução contábil ideal para sua empresa.";
