import type { CommercialWhatsAppIntent } from "@/integrations/whatsapp";
import { formatBrlCents, isPerNotePlan, monthlyWithDiscount } from "@/lib/commercial/pricing";

/**
 * Atendimento comercial da Dani para a emissão de notas (Fase 9).
 * Determinístico: perguntas fechadas e palavras-chave, sem modelo de IA
 * externo. Os valores vêm do catálogo APROVADO (API do servidor), nunca
 * escritos aqui. O texto livre do visitante só é classificado na própria
 * página: não é guardado nem enviado.
 */
export type CommercialIntent = "mei" | "somenteEmissao" | "contabilidade" | "combo" | "altoVolume" | "emitirAgora";
export type CommercialStep = "inicio" | "perfil";

export interface CatalogPlanLite {
  sku: string;
  name: string;
  monthlyCents: number | null;
  quota: number | null;
  overageCents: number | null;
}
export interface CommercialCatalog {
  plans: CatalogPlanLite[];
  comboDiscountBp: number;
}

export interface CommercialChoice {
  id: string;
  label: string;
}

export const COMMERCIAL_QUESTIONS: Record<CommercialStep, { message: string; choices: CommercialChoice[] }> = {
  inicio: {
    message: "Vamos encontrar a melhor opção. O que você precisa?",
    choices: [
      { id: "emissao", label: "Emitir notas de serviço (NFS-e)" },
      { id: "contabilidade", label: "Contabilidade completa" },
      { id: "combo", label: "Contabilidade + emissão de notas" },
      { id: "altoVolume", label: "Muitas notas (mais de 150 por mês)" },
      { id: "emitirAgora", label: "Quero emitir uma nota agora" },
    ],
  },
  perfil: {
    message: "Certo. Qual é o seu caso?",
    choices: [
      { id: "mei", label: "Sou MEI" },
      { id: "somenteEmissao", label: "Sou ME/EPP ou profissional, quero só a emissão" },
      { id: "combo", label: "Já sou cliente de contabilidade da WJB" },
    ],
  },
};

export type CommercialNext = { step: CommercialStep } | { intent: CommercialIntent };

export function nextCommercial(step: CommercialStep, choiceId: string): CommercialNext | null {
  if (step === "inicio") {
    if (choiceId === "emissao") return { step: "perfil" };
    if (["contabilidade", "combo", "altoVolume", "emitirAgora"].includes(choiceId)) return { intent: choiceId as CommercialIntent };
  }
  if (step === "perfil" && ["mei", "somenteEmissao", "combo"].includes(choiceId)) return { intent: choiceId as CommercialIntent };
  return null;
}

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Classifica o que o visitante escreveu. `null` = não entendi (mostra as opções). */
export function classifyCommercialText(text: string): CommercialIntent | null {
  const t = norm(text).slice(0, 300);
  if (!t.trim()) return null;
  if (/\b(agora|hoje|urgente|ja)\b.*\b(emitir|nota)|\bemitir (uma |a )?nota\b/.test(t) && !/\bplano|preco|valor|quanto\b/.test(t)) return "emitirAgora";
  if (/\b(\d{3,}|muitas|alto volume|volume)\b.*\bnotas?\b|\bnotas?\b.*\b(\d{3,}|por mes acima)/.test(t) || /alto volume/.test(t)) return "altoVolume";
  const wantsAccounting = /contabil|contador|honorario/.test(t);
  const wantsInvoices = /\bnotas?\b|nfs|nfse|emiss/.test(t);
  if ((wantsAccounting && wantsInvoices) || /\bcombo\b|ja sou cliente/.test(t)) return "combo";
  if (/\bmei\b|microempreendedor/.test(t)) return "mei";
  if (wantsAccounting) return "contabilidade";
  if (wantsInvoices) return "somenteEmissao";
  return null;
}

export type CommercialAction =
  | { kind: "route"; label: string; href: string }
  | { kind: "whatsapp"; label: string; intent: CommercialWhatsAppIntent };

export interface CommercialAnswer {
  message: string;
  actions: CommercialAction[];
}

const NOT_YET =
  "A emissão pela WJB ainda está em preparação: por aqui nenhuma nota é emitida e nada é cobrado. Você pode entrar na lista de interesse ou falar com a equipe.";

function planLine(p: CatalogPlanLite): string {
  if (p.monthlyCents === null) return `${p.name}: sob proposta`;
  if (isPerNotePlan(p)) return `${p.name}: sem mensalidade, ${formatBrlCents(p.overageCents)} por nota autorizada`;
  return `${p.name}: ${formatBrlCents(p.monthlyCents)}/mês com ${p.quota} notas, nota adicional ${formatBrlCents(p.overageCents)}`;
}

const find = (c: CommercialCatalog | null, sku: string) => c?.plans.find((p) => p.sku === sku) ?? null;

export function commercialAnswer(intent: CommercialIntent, catalog: CommercialCatalog | null): CommercialAnswer {
  const list = { kind: "route" as const, label: "Entrar na lista de interesse", href: "/emissao-de-notas#lista" };
  switch (intent) {
    case "mei": {
      const p = find(catalog, "nfse_mei");
      const price = p
        ? `O MEI Digital custa ${formatBrlCents(p.monthlyCents)} por mês, com ${p.quota} notas no ciclo. Nota adicional: ${formatBrlCents(p.overageCents)}, só com a sua autorização.`
        : "O MEI Digital tem mensalidade com franquia de notas; os valores estão na página de emissão.";
      return {
        message: `${price} Não inclui DAS, DASN-SIMEI nem contabilidade. ${NOT_YET}`,
        actions: [{ ...list, href: "/emissao-de-notas?plano=nfse_mei#lista" }, { kind: "whatsapp", label: "Falar sobre o MEI Digital no WhatsApp", intent: "mei" }],
      };
    }
    case "somenteEmissao": {
      const lines = ["nfse_avulsa", "nfse_profissional", "nfse_empresa"].map((s) => find(catalog, s)).filter((p): p is CatalogPlanLite => !!p).map(planLine);
      return {
        message: `A emissão pode ser contratada sozinha, sem contabilidade. ${lines.length ? `Opções: ${lines.join("; ")}.` : "Os valores estão na página de emissão."} ${NOT_YET}`,
        actions: [{ kind: "route", label: "Ver planos de emissão", href: "/emissao-de-notas#planos" }, list, { kind: "whatsapp", label: "Contratar só a emissão pelo WhatsApp", intent: "somenteEmissao" }],
      };
    }
    case "combo": {
      const pct = (catalog?.comboDiscountBp ?? 0) / 100;
      const mei = find(catalog, "nfse_mei");
      const example =
        mei && catalog?.comboDiscountBp
          ? ` Exemplo: o MEI Digital sai de ${formatBrlCents(mei.monthlyCents)} por ${formatBrlCents(monthlyWithDiscount(mei, catalog.comboDiscountBp))} por mês.`
          : "";
      return {
        message: `Quem tem contabilidade completa na WJB ganha ${pct ? `${pct}% de desconto` : "desconto"} na mensalidade do plano de notas, com a mesma conta.${example} O desconto não vale para os honorários de contabilidade, para a Nota Avulsa nem para notas adicionais. ${NOT_YET}`,
        actions: [{ ...list, href: "/emissao-de-notas?plano=combo#lista" }, { kind: "whatsapp", label: "Falar sobre o combo no WhatsApp", intent: "combo" }],
      };
    }
    case "contabilidade":
      return {
        message: "A contabilidade completa da WJB tem planos para MEI, Simples Nacional e Lucro Presumido, com honorários próprios (separados da emissão de notas). Se quiser, dá para somar a emissão depois, com desconto.",
        actions: [{ kind: "route", label: "Ver planos de contabilidade", href: "/planos" }, { kind: "whatsapp", label: "Falar com um contador no WhatsApp", intent: "contabilidade" }],
      };
    case "altoVolume":
      return {
        message: "Para mais de 150 notas por mês, o plano Alto Volume tem condições sob proposta, definidas em contrato. A equipe comercial monta a proposta com você.",
        actions: [{ kind: "whatsapp", label: "Pedir proposta no WhatsApp", intent: "altoVolume" }, { ...list, href: "/emissao-de-notas?plano=nfse_volume#lista" }],
      };
    case "emitirAgora":
      return {
        message: "Ainda não consigo emitir notas: a integração da WJB com o sistema nacional está em preparação e nada do que fizermos aqui gera nota fiscal. Se você precisa emitir agora, o emissor público de NFS-e é gratuito. Posso registrar seu interesse para avisarmos na liberação.",
        actions: [list, { kind: "whatsapp", label: "Tirar uma dúvida no WhatsApp", intent: "duvidaEmissao" }],
      };
  }
}
