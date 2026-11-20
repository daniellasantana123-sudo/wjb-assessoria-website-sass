import { afterEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/lib/auth/dal";
import type { MyOrganization } from "@/lib/tenant";
import {
  getFiscalProviderMode,
  isFiscalProductionAllowed,
  isWjbAiEnabled,
} from "@/lib/wjb-ai/config";
import {
  detectDocument,
  isValidCnpj,
  isValidCpf,
} from "@/lib/wjb-ai/fiscal/documents";
import { parseNfseDraft, toCents } from "@/lib/wjb-ai/fiscal/draft";
import { buildIdempotencyKey } from "@/lib/wjb-ai/fiscal/idempotency";
import { evaluatePolicy } from "@/lib/wjb-ai/fiscal/policy";
import { previewFiscalDraft } from "@/lib/wjb-ai/fiscal/preview";
import {
  MockFiscalProvider,
  getFiscalProvider,
} from "@/lib/wjb-ai/fiscal/provider";
import {
  InvalidFiscalTransitionError,
  assertTransition,
  canTransition,
  isOfficiallyAuthorized,
} from "@/lib/wjb-ai/fiscal/status";
import {
  canAccessTenantRecord,
  hasWjbAiPermission,
} from "@/lib/wjb-ai/permissions";

// Dados 100% sintéticos (seção 10.3 do documento mestre).
const TENANT_A: MyOrganization = {
  id: "tenant-a",
  name: "Salão A (sintético)",
  cnpj: "",
  role: "owner",
};
const TENANT_B: MyOrganization = {
  id: "tenant-b",
  name: "Studio B (sintético)",
  cnpj: "",
  role: "member",
};
const client: Session = {
  userId: "u-a",
  email: "a@exemplo.test",
  fullName: "A",
  isWjbStaff: false,
  staffRole: null,
};
const staff = (staffRole: Session["staffRole"]): Session => ({
  userId: "s-1",
  email: "s@exemplo.test",
  fullName: "S",
  isWjbStaff: true,
  staffRole,
});

const validBody = {
  serviceDescription: "Serviços de cabeleireiro - corte e escova",
  grossAmount: "250.00",
  competence: "2026-11",
  taker: { document: "529.982.247-25", name: "Tomadora Sintética" },
};

afterEach(() => vi.unstubAllEnvs());

describe("interruptores", () => {
  it("começam desligados e produção nunca é permitida neste incremento", () => {
    vi.stubEnv("WJB_AI_ENABLED", "");
    vi.stubEnv("FEATURE_FISCAL_PRODUCTION_ENABLED", "true");
    expect(isWjbAiEnabled()).toBe(false);
    expect(isFiscalProductionAllowed()).toBe(false);
    expect(getFiscalProviderMode()).toBe("mock");
  });

  it("homologação e produção recusam: não existe conector oficial", () => {
    vi.stubEnv("WJB_AI_FISCAL_MODE", "producao");
    expect(() => getFiscalProvider()).toThrow(/bloqueada/);
    vi.stubEnv("WJB_AI_FISCAL_MODE", "homologacao");
    expect(() => getFiscalProvider()).toThrow(/não implementado/);
    vi.stubEnv("WJB_AI_FISCAL_MODE", "qualquer-coisa");
    expect(getFiscalProvider().mode).toBe("mock");
  });
});

describe("documentos", () => {
  it("valida CPF e CNPJ numérico e alfanumérico", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    // Exemplo publicado pela Receita para o CNPJ alfanumérico.
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(detectDocument("12345")).toBeNull();
  });
});

describe("rascunho de NFS-e", () => {
  it("converte valor para centavos sem ponto flutuante", () => {
    expect(toCents("250")).toBe(25000);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("1234.56")).toBe(123456);
  });

  it("recusa tenant_id no corpo e campos fiscais vindos do cliente", () => {
    expect(parseNfseDraft({ ...validBody, tenant_id: TENANT_B.id }).ok).toBe(
      false,
    );
    expect(parseNfseDraft({ ...validBody, aliquota: "5" }).ok).toBe(false);
  });

  it("aponta o que falta em vez de inventar", () => {
    const result = parseNfseDraft({
      ...validBody,
      taker: { document: "000.000.000-00", name: "X Y" },
      grossAmount: "0",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingOrInvalid.map((e) => e.field)).toEqual([
        "taker.document",
        "grossAmount",
      ]);
    }
  });
});

describe("máquina de estados", () => {
  it("timeout nunca vira rejeição: passa por indeterminado e conciliação", () => {
    expect(canTransition("ENVIANDO", "RESULTADO_INDETERMINADO")).toBe(true);
    expect(canTransition("RESULTADO_INDETERMINADO", "REJEITADA")).toBe(false);
    expect(
      canTransition("RESULTADO_INDETERMINADO", "CONCILIACAO_OFICIAL"),
    ).toBe(true);
  });

  it("não pula confirmação nem reenvia nota autorizada", () => {
    expect(() => assertTransition("VALIDACAO_FISCAL", "ENFILEIRADA")).toThrow(
      InvalidFiscalTransitionError,
    );
    expect(canTransition("AUTORIZADA", "ENVIANDO")).toBe(false);
    expect(canTransition("REJEITADA", "ENVIANDO")).toBe(false);
  });

  it("só fala em nota emitida com retorno oficial", () => {
    expect(isOfficiallyAuthorized("ENVIANDO")).toBe(false);
    expect(isOfficiallyAuthorized("AUTORIZADA")).toBe(true);
  });
});

describe("política", () => {
  const draft = (() => {
    const r = parseNfseDraft(validBody);
    if (!r.ok) throw new Error("fixture inválida");
    return r.draft;
  })();
  const base = {
    moduleEnabled: true,
    draft,
    fiscalProfile: {
      approved: true as const,
      maxAmountCentsWithoutReview: 100000,
    },
    authorizationGrant: { status: "active" as const, validUntil: "2027-01-01" },
    duplicateSuspected: false,
    today: "2026-11-20",
  };

  it("sem perfil aprovado nem autorização, vai para revisão humana", () => {
    const r = evaluatePolicy({
      ...base,
      fiscalProfile: null,
      authorizationGrant: null,
    });
    expect(r.decision).toBe("HUMAN_REVIEW");
    expect(r.reasons).toEqual([
      "perfil_fiscal_nao_aprovado",
      "sem_autorizacao_de_emissao",
    ]);
  });

  it("tudo em ordem fica pronto para CONFIRMAÇÃO do cliente, nunca autoaprovado", () => {
    expect(evaluatePolicy(base)).toEqual({
      decision: "READY_FOR_CONFIRMATION",
      reasons: [],
    });
  });

  it("autorização vencida, valor alto, mercadoria e duplicidade pedem revisão", () => {
    expect(
      evaluatePolicy({
        ...base,
        authorizationGrant: { status: "active", validUntil: "2026-11-19" },
      }).reasons,
    ).toContain("autorizacao_vencida");
    expect(
      evaluatePolicy({
        ...base,
        fiscalProfile: { approved: true, maxAmountCentsWithoutReview: 1000 },
      }).reasons,
    ).toContain("valor_acima_do_limite");
    expect(
      evaluatePolicy({
        ...base,
        draft: {
          ...draft,
          serviceDescription: "Venda de mercadoria no balcão",
        },
      }).reasons,
    ).toContain("possivel_nota_de_mercadoria");
    expect(
      evaluatePolicy({ ...base, duplicateSuspected: true }).reasons,
    ).toContain("possivel_duplicidade");
  });

  it("módulo desligado bloqueia", () => {
    expect(evaluatePolicy({ ...base, moduleEnabled: false }).decision).toBe(
      "BLOCKED",
    );
  });
});

describe("idempotência e conector simulado", () => {
  const r = parseNfseDraft(validBody);
  if (!r.ok) throw new Error("fixture inválida");
  const draft = r.draft;

  it("mesma empresa e mesmo pedido geram a mesma chave; outra empresa, outra chave", () => {
    expect(buildIdempotencyKey("tenant-a", draft)).toBe(
      buildIdempotencyKey("tenant-a", { ...draft }),
    );
    expect(buildIdempotencyKey("tenant-a", draft)).not.toBe(
      buildIdempotencyKey("tenant-b", draft),
    );
    expect(buildIdempotencyKey("tenant-a", draft)).not.toBe(
      buildIdempotencyKey("tenant-a", {
        ...draft,
        sourceReference: "pedido-2",
      }),
    );
  });

  it("reenvio da mesma chave não emite de novo", async () => {
    const provider = new MockFiscalProvider();
    const req = {
      tenantId: "tenant-a",
      idempotencyKey: buildIdempotencyKey("tenant-a", draft),
      draft,
    };
    const first = await provider.submitAuthorizedDocument(req);
    const second = await provider.submitAuthorizedDocument(req);
    expect(first).toEqual(second);
    expect(provider.submissions).toBe(1);
    expect(first).toMatchObject({ status: "AUTORIZADA", simulated: true });
    if (first.status === "AUTORIZADA")
      expect(first.officialId.startsWith("SIMULADO-")).toBe(true);
  });

  it("resposta indeterminada é conciliada pela consulta, sem segundo envio", async () => {
    const provider = new MockFiscalProvider("indeterminado_depois_autorizada");
    const key = buildIdempotencyKey("tenant-a", draft);
    const first = await provider.submitAuthorizedDocument({
      tenantId: "tenant-a",
      idempotencyKey: key,
      draft,
    });
    expect(first.status).toBe("RESULTADO_INDETERMINADO");
    const status = await provider.getSubmissionStatus(key);
    expect(status?.status).toBe("AUTORIZADA");
    expect(provider.submissions).toBe(1);
  });
});

describe("permissões e isolamento por empresa", () => {
  it("ninguém tem fiscal.submit neste incremento, nem super_admin", () => {
    for (const s of [
      client,
      staff("super_admin"),
      staff("contador"),
      staff("atendimento"),
    ]) {
      expect(hasWjbAiPermission(s, "fiscal.submit", "owner")).toBe(false);
    }
    expect(hasWjbAiPermission(staff("atendimento"), "fiscal.review")).toBe(
      false,
    );
  });

  it("cliente da empresa A não acessa registro da empresa B", () => {
    expect(
      canAccessTenantRecord({
        session: client,
        sessionTenantId: "tenant-a",
        recordTenantId: "tenant-b",
      }),
    ).toBe(false);
    expect(
      canAccessTenantRecord({
        session: client,
        sessionTenantId: "tenant-a",
        recordTenantId: "tenant-a",
      }),
    ).toBe(true);
    expect(
      canAccessTenantRecord({
        session: client,
        sessionTenantId: null,
        recordTenantId: "tenant-a",
      }),
    ).toBe(false);
  });
});

describe("prévia (handler da rota)", () => {
  const deps = {
    moduleEnabled: true,
    session: client,
    tenant: TENANT_A,
    body: validBody,
    today: "2026-11-20",
  };

  it("módulo desligado responde 404", async () => {
    expect(
      (await previewFiscalDraft({ ...deps, moduleEnabled: false })).status,
    ).toBe(404);
  });

  it("sem sessão 401, equipe 403, sem empresa 403", async () => {
    expect((await previewFiscalDraft({ ...deps, session: null })).status).toBe(
      401,
    );
    expect(
      (await previewFiscalDraft({ ...deps, session: staff("contador") }))
        .status,
    ).toBe(403);
    expect((await previewFiscalDraft({ ...deps, tenant: null })).status).toBe(
      403,
    );
  });

  it("empresa vem da sessão: tentar apontar outra empresa no corpo é recusado", async () => {
    const res = await previewFiscalDraft({
      ...deps,
      body: { ...validBody, tenant_id: TENANT_B.id },
    });
    expect(res.status).toBe(422);
  });

  it("consultas de perfil e duplicidade usam só a empresa da sessão", async () => {
    const seen: string[] = [];
    await previewFiscalDraft({
      ...deps,
      tenant: TENANT_B,
      loadFiscalProfile: async (id) => (seen.push(id), null),
      loadAuthorizationGrant: async (id) => (seen.push(id), null),
      isDuplicate: async (id) => (seen.push(id), false),
    });
    expect(new Set(seen)).toEqual(new Set(["tenant-b"]));
  });

  it("nunca transmite, mascara o documento e explica a revisão", async () => {
    const res = await previewFiscalDraft(deps);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      simulated: true,
      transmitted: false,
    });
    const json = JSON.stringify(res.body);
    expect(json).not.toContain("52998224725");
    expect(json).toContain("***4725");
    expect(res.body.policy).toMatchObject({ decision: "HUMAN_REVIEW" });
  });
});
