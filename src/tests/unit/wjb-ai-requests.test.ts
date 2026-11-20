import { describe, expect, it } from "vitest";

import type { Session } from "@/lib/auth/dal";
import type { MyOrganization } from "@/lib/tenant";
import { nfseBodyFromForm } from "@/lib/wjb-ai/fiscal/form";
import { FISCAL_STATUS_LABELS } from "@/lib/wjb-ai/fiscal/labels";
import {
  FISCAL_STATUSES,
  isOfficiallyAuthorized,
} from "@/lib/wjb-ai/fiscal/status";
import {
  planInitialPath,
  submitFiscalRequest,
  type FiscalRequestRepo,
} from "@/lib/wjb-ai/fiscal/requests";

const client: Session = {
  userId: "u-a",
  email: "",
  fullName: null,
  isWjbStaff: false,
  staffRole: null,
};
const tenantA: MyOrganization = {
  id: "tenant-a",
  name: "A (fictícia)",
  cnpj: "",
  role: "member",
};
const body = {
  serviceDescription: "Serviços de manicure",
  grossAmount: "80.00",
  competence: "2026-11",
  taker: { document: "529.982.247-25", name: "Tomadora Fictícia" },
};

function fakeRepo(overrides: Partial<FiscalRequestRepo> = {}) {
  const calls: {
    inserted: string[];
    transitions: { tenantId: string; to: string[] }[];
    audits: string[];
  } = {
    inserted: [],
    transitions: [],
    audits: [],
  };
  const repo: FiscalRequestRepo = {
    async insertRequest(row) {
      calls.inserted.push(row.tenantId);
      return { id: "req-1" };
    },
    async loadApprovedProfile() {
      return null;
    },
    async loadActiveGrant() {
      return null;
    },
    async applyTransitions(i) {
      calls.transitions.push({
        tenantId: i.tenantId,
        to: i.steps.map((s) => s.to),
      });
      return true;
    },
    async audit(i) {
      calls.audits.push(i.status);
    },
    ...overrides,
  };
  return { repo, calls };
}
const base = (repo: FiscalRequestRepo) => ({
  session: client,
  tenant: tenantA,
  expectedTenantId: "tenant-a",
  body,
  today: "2026-11-20",
  repo,
});

describe("caminho inicial do pedido", () => {
  it("revisão humana, pronto e bloqueado só usam transições válidas", () => {
    expect(planInitialPath("HUMAN_REVIEW").map((s) => s.to)).toEqual([
      "TRIAGEM",
      "VALIDACAO_FISCAL",
      "REVISAO_HUMANA",
    ]);
    expect(planInitialPath("READY_FOR_CONFIRMATION").at(-1)?.to).toBe(
      "CONFIRMADA",
    );
    expect(planInitialPath("BLOCKED").at(-1)?.to).toBe("BLOQUEADA");
  });
});

describe("registro da solicitação", () => {
  it("sem perfil aprovado: grava, registra eventos e encaminha para revisão", async () => {
    const { repo, calls } = fakeRepo();
    const r = await submitFiscalRequest(base(repo));
    expect(r).toEqual({
      ok: true,
      requestId: "req-1",
      status: "REVISAO_HUMANA",
      duplicate: false,
    });
    expect(calls.transitions[0].to).toEqual([
      "TRIAGEM",
      "VALIDACAO_FISCAL",
      "REVISAO_HUMANA",
    ]);
    expect(calls.audits).toEqual(["REVISAO_HUMANA"]);
  });

  it("com perfil e autorização válidos: confirmada, nunca enviada nem autorizada", async () => {
    const { repo } = fakeRepo({
      async loadApprovedProfile() {
        return { approved: true, maxAmountCentsWithoutReview: 100000 };
      },
      async loadActiveGrant() {
        return { status: "active", validUntil: "2027-12-31" };
      },
    });
    const r = await submitFiscalRequest(base(repo));
    expect(r.ok && r.status).toBe("CONFIRMADA");
    expect(r.ok && isOfficiallyAuthorized(r.status)).toBe(false);
  });

  it("pedido repetido devolve o existente sem criar outro nem mexer em estado", async () => {
    const { repo, calls } = fakeRepo({
      async insertRequest() {
        return { duplicateOfId: "req-antigo" };
      },
    });
    const r = await submitFiscalRequest(base(repo));
    expect(r).toMatchObject({
      ok: true,
      requestId: "req-antigo",
      duplicate: true,
    });
    expect(calls.transitions).toHaveLength(0);
  });

  it("se as transições falham, o pedido fica como Recebida (não finge andamento)", async () => {
    const { repo } = fakeRepo({
      async applyTransitions() {
        return false;
      },
    });
    const r = await submitFiscalRequest(base(repo));
    expect(r.ok && r.status).toBe("RECEBIDA");
  });

  it("empresa ativa trocada entre a tela e o envio: recusa", async () => {
    const { repo, calls } = fakeRepo();
    const r = await submitFiscalRequest({
      ...base(repo),
      expectedTenantId: "tenant-b",
    });
    expect(r.ok).toBe(false);
    expect(calls.inserted).toHaveLength(0);
  });

  it("grava sempre na empresa da sessão", async () => {
    const { repo, calls } = fakeRepo();
    await submitFiscalRequest({ ...base(repo), body: { ...body } });
    expect(calls.inserted).toEqual(["tenant-a"]);
    expect(calls.transitions.every((t) => t.tenantId === "tenant-a")).toBe(
      true,
    );
  });

  it("equipe, sem empresa e dados inválidos não gravam nada", async () => {
    const { repo, calls } = fakeRepo();
    expect(
      (
        await submitFiscalRequest({
          ...base(repo),
          session: { ...client, isWjbStaff: true, staffRole: "contador" },
        })
      ).ok,
    ).toBe(false);
    expect(
      (await submitFiscalRequest({ ...base(repo), tenant: null })).ok,
    ).toBe(false);
    const invalid = await submitFiscalRequest({
      ...base(repo),
      body: { ...body, grossAmount: "abc" },
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.fields?.[0].field).toBe("grossAmount");
    expect(calls.inserted).toHaveLength(0);
  });
});

describe("formulário e textos", () => {
  it("converte valor brasileiro e ignora campos de empresa", () => {
    const fd = new FormData();
    fd.set("grossAmount", "1.234,56");
    fd.set("serviceDescription", "x");
    fd.set("tenant_id", "tenant-b");
    const out = nfseBodyFromForm(fd);
    expect(out.grossAmount).toBe("1234.56");
    expect(JSON.stringify(out)).not.toContain("tenant-b");
  });

  it("todo estado tem texto, e nenhum anterior a AUTORIZADA fala em emitida", () => {
    for (const s of FISCAL_STATUSES) {
      expect(FISCAL_STATUS_LABELS[s]).toBeTruthy();
      if (!isOfficiallyAuthorized(s))
        expect(FISCAL_STATUS_LABELS[s].toLowerCase()).not.toMatch(
          /emitid|autorizada$/,
        );
    }
  });
});
