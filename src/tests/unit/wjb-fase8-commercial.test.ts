import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { isRealBillingEnabled } from "@/lib/commercial/config";
import {
  canConsume,
  comboDiscountBp,
  cycleFor,
  invoicePreview,
  marginAt,
  monthlyWithDiscount,
  usageSummary,
  type SubscriptionSnapshot,
} from "@/lib/commercial/pricing";
import { leadFormSchema, NFSE_PRE_REGISTRATION_CONTEXT } from "@/lib/validation/lead";
import {
  isBusinessHours,
  maskPhone,
  MockWhatsAppProvider,
  parseWebhookPayload,
  ReplayGuard,
  verifyWebhookSignature,
  createCloudApiProvider,
  WhatsAppNotConnectedError,
} from "@/lib/whatsapp/provider";

// Valores do RASCUNHO do documento da Fase 8 (não aprovados), só para teste.
const mei = { sku: "nfse_mei", monthlyCents: 2490, quota: 10, overageCents: 390 };
const avulsa = { sku: "nfse_avulsa", monthlyCents: 0, quota: null, overageCents: 490 };
const volume = { sku: "nfse_volume", monthlyCents: null, quota: null, overageCents: null };
const sub = (over: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
  ...mei,
  discountBp: 0,
  status: "ativa_simulada",
  overageAuthorized: false,
  spendingLimitCents: null,
  ...over,
});

describe("preço e desconto do combo", () => {
  it("20% só para cliente de contabilidade, só na mensalidade, com teto de 50%", () => {
    expect(comboDiscountBp(true, 2000)).toBe(2000);
    expect(comboDiscountBp(false, 2000)).toBe(0);
    expect(comboDiscountBp(true, 9000)).toBe(5000);
    expect(monthlyWithDiscount(mei, 2000)).toBe(1992);
    expect(monthlyWithDiscount(volume, 2000)).toBeNull();
  });
  it("cobrança real nunca está ligada nesta fase", () => {
    expect(isRealBillingEnabled()).toBe(false);
  });
});

describe("franquia e alertas", () => {
  it("80%, 100% e excedente", () => {
    expect(usageSummary(10, 7).alert).toBe("nenhum");
    expect(usageSummary(10, 8).alert).toBe("80");
    expect(usageSummary(10, 10).alert).toBe("100");
    expect(usageSummary(10, 12)).toMatchObject({ alert: "excedente", overageCount: 2 });
    expect(usageSummary(null, 3).alert).toBe("nenhum");
  });
});

describe("pode registrar mais uma nota?", () => {
  it("dentro da franquia: sim", () => {
    expect(canConsume(sub(), 9)).toMatchObject({ allowed: true, overage: false });
  });
  it("franquia acabou sem autorização: não (excedente nunca sem aviso)", () => {
    expect(canConsume(sub(), 10)).toEqual({ allowed: false, reason: "excedente_nao_autorizado" });
  });
  it("autorizado: sim, até o limite de gasto", () => {
    const s = sub({ overageAuthorized: true, spendingLimitCents: 780 }); // 2 notas extras
    expect(canConsume(s, 10)).toMatchObject({ allowed: true, overage: true, overageCostCents: 390 });
    expect(canConsume(s, 11)).toMatchObject({ allowed: true });
    expect(canConsume(s, 12)).toEqual({ allowed: false, reason: "limite_de_gasto" });
  });
  it("sem assinatura, suspensa ou cancelada: não", () => {
    expect(canConsume(null, 0)).toEqual({ allowed: false, reason: "sem_assinatura_ativa" });
    expect(canConsume(sub({ status: "suspensa" }), 0)).toEqual({ allowed: false, reason: "sem_assinatura_ativa" });
  });
  it("avulso cobra por nota sem precisar autorizar excedente; sob proposta fala com o comercial", () => {
    expect(canConsume(sub({ ...avulsa }), 5)).toMatchObject({ allowed: true, overage: false, overageCostCents: 490 });
    expect(canConsume(sub({ ...volume }), 0)).toEqual({ allowed: false, reason: "sob_proposta" });
  });
});

describe("prévia de fatura", () => {
  it("é sempre simulação; nota simulada nunca gera excedente cobrado", () => {
    const inv = invoicePreview(sub({ discountBp: 2000 }), 0, 15);
    expect(inv.simulated).toBe(true);
    expect(inv.lines.map((l) => l.label)).toEqual(["Mensalidade nfse_mei", "Desconto cliente de contabilidade (só mensalidade)"]);
    expect(inv.totalCents).toBe(1992);
    expect(inv.note).toMatch(/15 nota\(s\) simulada\(s\).*não geram cobrança/);
  });
  it("só evento OFICIAL faturável entraria como excedente", () => {
    expect(invoicePreview(sub(), 12, 0).totalCents).toBe(2490 + 2 * 390);
  });
  it("desconto do combo não incide sobre o excedente", () => {
    const inv = invoicePreview(sub({ discountBp: 2000 }), 11, 0);
    expect(inv.lines.find((l) => l.label.startsWith("Excedente"))?.cents).toBe(390);
  });
});

describe("ciclo e margem", () => {
  it("ciclo mensal com virada de ano", () => {
    expect(cycleFor("2026-12-15")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
  it("sem premissas de custo da WJB, a margem não é calculada (nada inventado)", () => {
    expect(marginAt(mei, 10, 0, { costPerNoteCents: null, fixedCostPerClientCents: null })).toEqual({ defined: false });
    expect(marginAt(mei, 12, 0, { costPerNoteCents: 50, fixedCostPerClientCents: 1000 })).toMatchObject({ defined: true, revenueCents: 2490 + 780, costCents: 1600 });
  });
});

describe("pré-cadastro: telefone opcional só nesse formulário", () => {
  const base = { name: "Fulana Fictícia", email: "f@exemplo.test", serviceInterest: "Emissão de notas", consent: true, tracking: { sourcePath: "/x", utmSource: null, utmMedium: null, utmCampaign: null } };
  it("pré-cadastro aceita sem telefone, mas recusa telefone inválido", () => {
    expect(leadFormSchema.safeParse({ ...base, phone: "", formContext: NFSE_PRE_REGISTRATION_CONTEXT }).success).toBe(true);
    expect(leadFormSchema.safeParse({ ...base, phone: "123", formContext: NFSE_PRE_REGISTRATION_CONTEXT }).success).toBe(false);
  });
  it("demais formulários continuam exigindo WhatsApp", () => {
    expect(leadFormSchema.safeParse({ ...base, phone: "", formContext: "Contato" }).success).toBe(false);
  });
});

describe("WhatsApp simulado", () => {
  const optIn = { optedIn: true, optedOutAt: null };
  const monday10 = new Date("2026-11-23T13:00:00Z"); // 10h em Brasília
  const sunday = new Date("2026-11-22T13:00:00Z");
  it("Cloud API real está bloqueada", () => {
    expect(() => createCloudApiProvider()).toThrow(WhatsAppNotConnectedError);
  });
  it("exige opt-in, respeita opt-out e horário; ids marcados SIMULADO", async () => {
    const p = new MockWhatsAppProvider();
    expect((await p.send({ to: "x", text: "oi" }, null, monday10)).reason).toBe("sem_opt_in");
    expect((await p.send({ to: "x", text: "oi" }, { optedIn: true, optedOutAt: "2026-11-01" }, monday10)).reason).toBe("sem_opt_in");
    expect((await p.send({ to: "x", text: "oi" }, optIn, sunday)).reason).toBe("fora_do_horario_sem_modelo");
    const ok = await p.send({ to: "x", text: "oi" }, optIn, monday10);
    expect(ok).toMatchObject({ status: "entregue" });
    expect(ok.id).toMatch(/^SIMULADO-WA-/);
    expect((await p.send({ to: "x", template: "aviso_nota" }, optIn, sunday)).status).toBe("entregue");
    expect(p.connected).toBe(false);
    expect(isBusinessHours(monday10)).toBe(true);
  });
  it("assinatura do webhook (X-Hub-Signature-256)", () => {
    const body = '{"entry":[]}';
    const sig = "sha256=" + createHmac("sha256", "segredo-de-teste").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, "segredo-de-teste")).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, "segredo-de-teste")).toBe(false);
    expect(verifyWebhookSignature(body, sig, "outro")).toBe(false);
    expect(verifyWebhookSignature(body, null, "segredo-de-teste")).toBe(false);
  });
  it("anti-replay e telefone mascarado", () => {
    const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.1", timestamp: "1000", from: "5511999990000", type: "text" }] } }] }] };
    const evs = parseWebhookPayload(payload);
    expect(evs[0].fromRef).toBe("***0000");
    expect(JSON.stringify(evs)).not.toContain("5511999990000");
    const g = new ReplayGuard();
    expect(g.accept(evs[0], 1010)).toBe("novo");
    expect(g.accept(evs[0], 1020)).toBe("repetido");
    expect(g.accept({ ...evs[0], id: "wamid.2" }, 2000)).toBe("fora_da_janela");
    expect(maskPhone("1")).toBe("***");
  });
});
