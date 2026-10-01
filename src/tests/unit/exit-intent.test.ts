import { describe, expect, it } from "vitest";

import {
  canShowPopup,
  DISMISS_COOLDOWN_MS,
  isExcludedPath,
  parseStoredState,
} from "@/lib/marketing/exit-intent";
import { exitIntentLeadSchema } from "@/lib/validation/lead";

const now = 1_800_000_000_000;

describe("popup Antes de sair: quando pode aparecer", () => {
  it("aparece numa página comum, na primeira vez", () => {
    expect(canShowPopup({ pathname: "/servicos", stored: null, shownThisSession: false, now })).toBe(true);
  });

  it("não aparece em páginas que já têm formulário, no guia ou nas telas de acesso", () => {
    for (const path of ["/contato", "/solicitar-proposta", "/servicos/abrir-empresa", "/ajuda", "/login", "/portal/documentos"]) {
      expect(isExcludedPath(path)).toBe(true);
    }
    expect(isExcludedPath("/servicos/fiscal-tributario")).toBe(false);
  });

  it("uma vez por visita", () => {
    expect(canShowPopup({ pathname: "/", stored: null, shownThisSession: true, now })).toBe(false);
  });

  it("fechou: volta só depois de 7 dias", () => {
    const dismissed = { status: "dismissed" as const, at: now - 1000 };
    expect(canShowPopup({ pathname: "/", stored: dismissed, shownThisSession: false, now })).toBe(false);
    const old = { status: "dismissed" as const, at: now - DISMISS_COOLDOWN_MS - 1 };
    expect(canShowPopup({ pathname: "/", stored: old, shownThisSession: false, now })).toBe(true);
  });

  it("enviou: nunca mais", () => {
    const submitted = { status: "submitted" as const, at: now - 365 * 24 * 3600 * 1000 };
    expect(canShowPopup({ pathname: "/", stored: submitted, shownThisSession: false, now })).toBe(false);
  });

  it("valor estranho no storage não quebra nada", () => {
    expect(parseStoredState("{lixo")).toBeNull();
    expect(parseStoredState('{"status":"outro","at":1}')).toBeNull();
  });
});

describe("formulário curto do popup", () => {
  it("exige nome, WhatsApp, e-mail, assunto e consentimento", () => {
    const result = exitIntentLeadSchema.safeParse({ name: "", phone: "", email: "x", serviceInterest: "", consent: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0]).sort()).toEqual(["consent", "email", "name", "phone", "serviceInterest"]);
  });

  it("empresa é opcional", () => {
    expect(
      exitIntentLeadSchema.safeParse({ name: "Maria", phone: "11976146375", email: "maria@empresa.com.br", serviceInterest: "Abrir uma empresa", consent: true }).success,
    ).toBe(true);
  });
});
