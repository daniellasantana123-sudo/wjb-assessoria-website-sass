import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { pushEvent, resetSentEventIds, sanitizeParams } from "@/lib/analytics/datalayer";
import {
  buildConsentBootstrapScript,
  isTrackedPath,
} from "@/lib/consent/consent-mode";
import { getGtmId } from "@/config/analytics";

describe("sanitizeParams", () => {
  it("descarta qualquer parâmetro fora da lista, inclusive dados pessoais", () => {
    const clean = sanitizeParams({
      form_id: "Contato",
      email: "pessoa@exemplo.com",
      phone: "11999999999",
      name: "Fulano",
      cnpj: "00.000.000/0001-00",
    });
    expect(clean).toEqual({ form_id: "Contato" });
  });

  it("corta textos longos e ignora vazios", () => {
    const clean = sanitizeParams({ service_name: "x".repeat(300), form_id: "  " });
    expect(clean.service_name).toHaveLength(100);
    expect(clean).not.toHaveProperty("form_id");
  });
});

describe("pushEvent", () => {
  const w = window as Window & { dataLayer?: unknown[] };
  beforeEach(() => {
    w.dataLayer = [];
    window.history.pushState({}, "", "/servicos/abrir-empresa");
    resetSentEventIds();
  });
  afterEach(() => {
    delete w.dataLayer;
  });

  it("empurra o evento com o caminho da página", () => {
    pushEvent("form_start", { form_id: "Abrir Empresa" });
    expect(w.dataLayer).toEqual([
      { event: "form_start", page_path: "/servicos/abrir-empresa", form_id: "Abrir Empresa" },
    ]);
  });

  it("não repete um event_id já enviado (deduplicação)", () => {
    expect(pushEvent("generate_lead", { event_id: "abc" })).toBe(true);
    expect(pushEvent("generate_lead", { event_id: "abc" })).toBe(false);
    expect(w.dataLayer).toHaveLength(1);
  });
});

describe("Consent Mode", () => {
  it("começa com tudo negado e só carrega o GTM com consentimento salvo", () => {
    const script = buildConsentBootstrapScript("GTM-TESTE01");
    const defaultIndex = script.indexOf("'consent','default'");
    const loadIndex = script.indexOf("gtm.js?id=");
    expect(defaultIndex).toBeGreaterThan(-1);
    expect(script).toContain('"ad_user_data":"denied"');
    expect(script).toContain('"ad_personalization":"denied"');
    expect(script).toContain('"analytics_storage":"denied"');
    expect(loadIndex).toBeGreaterThan(defaultIndex);
    expect(script).toContain("==='accepted'");
  });

  it("deixa as telas de senha fora da medição", () => {
    expect(isTrackedPath("/login")).toBe(false);
    expect(isTrackedPath("/definir-senha")).toBe(false);
    expect(isTrackedPath("/recuperar-senha")).toBe(false);
    expect(isTrackedPath("/verificar-mfa")).toBe(false);
    expect(isTrackedPath("/")).toBe(true);
    expect(isTrackedPath("/servicos/abrir-empresa")).toBe(true);
  });
});

describe("getGtmId", () => {
  it("só aceita IDs no formato GTM-XXXX", () => {
    // Vazio enquanto a WJB não fornecer o ID real: medição desligada.
    const id = getGtmId();
    expect(id === null || /^GTM-[A-Z0-9]+$/.test(id)).toBe(true);
  });
});
