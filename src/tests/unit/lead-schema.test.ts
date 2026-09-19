import { describe, expect, it } from "vitest";

import { leadFormSchema, newsletterFormSchema } from "@/lib/validation/lead";

const baseTracking = {
  sourcePath: "/contato",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
};

const validLeadPayload = {
  name: "Maria Teste",
  email: "maria@example.com",
  phone: "11999998888",
  company: "",
  cnpj: "",
  serviceInterest: "Contabilidade",
  message: "Quero saber mais sobre os serviços.",
  consent: true,
  formContext: "Contato",
  tracking: baseTracking,
};

describe("leadFormSchema", () => {
  it("aceita um payload válido", () => {
    const result = leadFormSchema.safeParse(validLeadPayload);
    expect(result.success).toBe(true);
  });

  it("rejeita nome muito curto", () => {
    const result = leadFormSchema.safeParse({ ...validLeadPayload, name: "a" });
    expect(result.success).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    const result = leadFormSchema.safeParse({ ...validLeadPayload, email: "nao-e-email" });
    expect(result.success).toBe(false);
  });

  it("rejeita mensagem muito curta", () => {
    const result = leadFormSchema.safeParse({ ...validLeadPayload, message: "curta" });
    expect(result.success).toBe(false);
  });

  it("rejeita WhatsApp ausente", () => {
    const result = leadFormSchema.safeParse({ ...validLeadPayload, phone: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita assunto não selecionado", () => {
    const result = leadFormSchema.safeParse({ ...validLeadPayload, serviceInterest: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita quando o consentimento não é aceito", () => {
    const result = leadFormSchema.safeParse({ ...validLeadPayload, consent: false });
    expect(result.success).toBe(false);
  });
});

describe("newsletterFormSchema", () => {
  it("aceita um e-mail válido", () => {
    const result = newsletterFormSchema.safeParse({
      email: "maria@example.com",
      tracking: baseTracking,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = newsletterFormSchema.safeParse({
      email: "nao-e-email",
      tracking: baseTracking,
    });
    expect(result.success).toBe(false);
  });
});
