import { describe, expect, it } from "vitest";

import {
  classifyCommercialText,
  COMMERCIAL_QUESTIONS,
  commercialAnswer,
  nextCommercial,
  type CommercialCatalog,
} from "@/lib/assistant/commercial-flow";
import { assistantMenuOptions } from "@/lib/assistant/assistant-config";
import { ACCEPTANCE_DOCUMENTS, canConsume, invoicePreview, isPerNotePlan, usageSummary, type SubscriptionSnapshot } from "@/lib/commercial/pricing";

// Valores aprovados pela WJB em 21/11/2026 (aqui só como dado de teste; o
// sistema lê do catálogo no banco).
const catalog: CommercialCatalog = {
  comboDiscountBp: 2000,
  plans: [
    { sku: "nfse_avulsa", name: "Nota Avulsa", monthlyCents: 0, quota: 0, overageCents: 490 },
    { sku: "nfse_mei", name: "MEI Digital", monthlyCents: 2490, quota: 10, overageCents: 390 },
    { sku: "nfse_profissional", name: "Profissional", monthlyCents: 6990, quota: 50, overageCents: 250 },
    { sku: "nfse_empresa", name: "Empresa", monthlyCents: 14990, quota: 150, overageCents: 150 },
    { sku: "nfse_volume", name: "Alto Volume", monthlyCents: null, quota: null, overageCents: null },
  ],
};
const sub = (p: (typeof catalog.plans)[number], over: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
  ...p,
  discountBp: 0,
  status: "ativa_simulada",
  overageAuthorized: false,
  spendingLimitCents: null,
  ...over,
});
const [avulsa, mei, , , volume] = catalog.plans;
// Intl usa espaço não separável entre "R$" e o valor.
const say = (i: Parameters<typeof commercialAnswer>[0], c: CommercialCatalog | null = catalog) => commercialAnswer(i, c).message.replace(/\u00a0/g, " ");

describe("Nota Avulsa com franquia 0 (aprovada)", () => {
  it("é cobrança por nota, sem excedente nem alerta de franquia", () => {
    expect(isPerNotePlan(avulsa)).toBe(true);
    expect(isPerNotePlan(mei)).toBe(false);
    expect(isPerNotePlan(volume)).toBe(false);
    expect(usageSummary(0, 5)).toMatchObject({ alert: "nenhum", overageCount: 0 });
    expect(canConsume(sub(avulsa), 0)).toEqual({ allowed: true, overage: false, overageCostCents: 490 });
  });
  it("respeita o limite de gasto quando o cliente define um", () => {
    expect(canConsume(sub(avulsa, { spendingLimitCents: 980 }), 2)).toEqual({ allowed: false, reason: "limite_de_gasto" });
  });
  it("fatura mostra notas avulsas oficiais, nunca simuladas", () => {
    expect(invoicePreview(sub(avulsa), 0, 7).totalCents).toBe(0);
    const inv = invoicePreview(sub(avulsa), 3, 0);
    expect(inv.lines).toEqual([{ label: "Mensalidade nfse_avulsa", cents: 0 }, { label: "Notas avulsas: 3 nota(s) oficial(is)", cents: 1470 }]);
  });
  it("Alto Volume nunca é calculado (contratual)", () => {
    expect(canConsume(sub(volume), 0)).toEqual({ allowed: false, reason: "sob_proposta" });
  });
  it("aceite de preço aponta para a versão aprovada; os textos jurídicos seguem minuta", () => {
    expect(ACCEPTANCE_DOCUMENTS.precos_franquia.version).toBe("2026-11-21-aprovado");
    expect(ACCEPTANCE_DOCUMENTS.termos_emissao.version).toMatch(/rascunho/);
  });
});

describe("Dani: atendimento comercial determinístico", () => {
  it("menu tem a emissão de notas", () => {
    expect(assistantMenuOptions.some((o) => o.key === "emissaoNotas")).toBe(true);
  });
  it("conduz as três jornadas: só emissão, contabilidade e combo (e MEI dentro da emissão)", () => {
    expect(nextCommercial("inicio", "emissao")).toEqual({ step: "perfil" });
    expect(nextCommercial("perfil", "mei")).toEqual({ intent: "mei" });
    expect(nextCommercial("perfil", "somenteEmissao")).toEqual({ intent: "somenteEmissao" });
    expect(nextCommercial("inicio", "contabilidade")).toEqual({ intent: "contabilidade" });
    expect(nextCommercial("inicio", "combo")).toEqual({ intent: "combo" });
    expect(nextCommercial("inicio", "inventado")).toBeNull();
    expect(COMMERCIAL_QUESTIONS.inicio.choices).toHaveLength(5);
  });
  it("explica valores a partir do catálogo, com desconto só na mensalidade", () => {
    expect(say("mei")).toContain("R$ 24,90");
    const combo = say("combo");
    expect(combo).toContain("20% de desconto");
    expect(combo).toContain("R$ 19,92");
    expect(combo).toMatch(/não vale para os honorários/);
    const only = say("somenteEmissao");
    expect(only).toContain("Nota Avulsa: sem mensalidade, R$ 4,90 por nota autorizada");
    expect(only).toContain("Empresa: R$ 149,90/mês com 150 notas");
  });
  it("sem catálogo, não inventa preço", () => {
    expect(commercialAnswer("mei", null).message).not.toMatch(/R\$/);
    expect(commercialAnswer("somenteEmissao", null).message).not.toMatch(/R\$/);
  });
  it("nunca diz que uma nota foi emitida", () => {
    for (const i of ["mei", "somenteEmissao", "combo", "contabilidade", "altoVolume", "emitirAgora"] as const) {
      expect(commercialAnswer(i, catalog).message).not.toMatch(/nota (foi )?emitida|emitimos/i);
    }
    expect(commercialAnswer("emitirAgora", catalog).message).toMatch(/Ainda não consigo emitir/);
  });
  it("encaminha ao pré-cadastro e ao WhatsApp da intenção certa", () => {
    expect(commercialAnswer("altoVolume", catalog).actions).toContainEqual({ kind: "whatsapp", label: "Pedir proposta no WhatsApp", intent: "altoVolume" });
    expect(commercialAnswer("mei", catalog).actions[0]).toMatchObject({ kind: "route", href: "/emissao-de-notas?plano=nfse_mei#lista" });
  });
  it("classifica texto livre sem IA", () => {
    expect(classifyCommercialText("Sou MEI e emito poucas notas")).toBe("mei");
    expect(classifyCommercialText("quero contabilidade e emissão de notas")).toBe("combo");
    expect(classifyCommercialText("Já sou cliente da WJB")).toBe("combo");
    expect(classifyCommercialText("preciso de um contador")).toBe("contabilidade");
    expect(classifyCommercialText("emito 300 notas por mês")).toBe("altoVolume");
    expect(classifyCommercialText("preciso emitir uma nota agora")).toBe("emitirAgora");
    expect(classifyCommercialText("quero só emitir NFS-e")).toBe("somenteEmissao");
    expect(classifyCommercialText("bom dia")).toBeNull();
  });
});
