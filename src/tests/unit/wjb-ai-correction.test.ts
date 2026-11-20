import { Building2, FileText } from "lucide-react";
import { describe, expect, it } from "vitest";

import { visibleNavItems } from "@/config/portal-nav";
import type { Session } from "@/lib/auth/dal";
import { buildFiscalNotice } from "@/lib/wjb-ai/fiscal/notices";
import {
  correctFiscalRequest,
  planCorrectionPath,
  type CorrectionRepo,
} from "@/lib/wjb-ai/fiscal/requests";

const client: Session = {
  userId: "u-a",
  email: "",
  fullName: null,
  isWjbStaff: false,
  staffRole: null,
};
const tenant = { id: "tenant-a", name: "A", cnpj: "", role: "owner" as const };
const body = {
  serviceDescription: "Serviço corrigido",
  grossAmount: "90.00",
  competence: "2026-11",
  taker: { document: "529.982.247-25", name: "Tomador" },
};
const oldDraft = {
  serviceDescription: "Serviço",
  amountCents: 8000,
  competence: "2026-11",
  taker: {
    document: "52998224725",
    documentKind: "CPF" as const,
    name: "Tomador",
  },
};

function repo(
  status = "DADOS_PENDENTES",
  result: "ok" | "duplicate" | "conflict" = "ok",
) {
  const calls: Parameters<CorrectionRepo["applyCorrection"]>[0][] = [];
  const r: CorrectionRepo = {
    async loadForCorrection(tenantId) {
      return tenantId === "tenant-a"
        ? { status: status as never, draft: oldDraft, draftHash: "h-old" }
        : null;
    },
    async loadApprovedProfile() {
      return null;
    },
    async loadActiveGrant() {
      return null;
    },
    async applyCorrection(i) {
      calls.push(i);
      return result;
    },
  };
  return { r, calls };
}
const base = (r: CorrectionRepo) => ({
  session: client,
  tenant,
  expectedTenantId: "tenant-a",
  requestId: "req-1",
  body,
  today: "2026-11-20",
  repo: r,
});

describe("correção de pedido devolvido", () => {
  it("volta à triagem e passa de novo pela política", () => {
    expect(planCorrectionPath("HUMAN_REVIEW").map((s) => s.to)).toEqual([
      "TRIAGEM",
      "VALIDACAO_FISCAL",
      "REVISAO_HUMANA",
    ]);
    expect(planCorrectionPath("READY_FOR_CONFIRMATION")[0]).toMatchObject({
      from: "DADOS_PENDENTES",
      to: "TRIAGEM",
    });
  });

  it("guarda a versão anterior e grava o novo rascunho na empresa da sessão", async () => {
    const { r, calls } = repo();
    const res = await correctFiscalRequest(base(r));
    expect(res).toMatchObject({
      ok: true,
      requestId: "req-1",
      status: "REVISAO_HUMANA",
    });
    expect(calls[0].tenantId).toBe("tenant-a");
    expect(calls[0].previous).toEqual({ draft: oldDraft, draftHash: "h-old" });
    expect(calls[0].draft.amountCents).toBe(9000);
  });

  it("só corrige pedido em DADOS_PENDENTES e da própria empresa", async () => {
    expect((await correctFiscalRequest(base(repo("CONFIRMADA").r))).ok).toBe(
      false,
    );
    expect(
      (
        await correctFiscalRequest({
          ...base(repo().r),
          tenant: { ...tenant, id: "tenant-b" },
          expectedTenantId: "tenant-b",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await correctFiscalRequest({
          ...base(repo().r),
          expectedTenantId: "tenant-b",
        })
      ).ok,
    ).toBe(false);
  });

  it("dados iguais a outro pedido e alteração concorrente são recusados", async () => {
    expect(
      await correctFiscalRequest(base(repo("DADOS_PENDENTES", "duplicate").r)),
    ).toMatchObject({ ok: false });
    expect(
      await correctFiscalRequest(base(repo("DADOS_PENDENTES", "conflict").r)),
    ).toMatchObject({ ok: false });
  });
});

describe("avisos ao cliente", () => {
  it("não levam dado pessoal e apontam para o pedido no Portal", () => {
    const n = buildFiscalNotice(
      "correction_requested",
      "req-1",
      "Falta o e-mail do tomador",
    );
    expect(n).toMatchObject({
      type: "fiscal_request.reviewed",
      link: "/portal/nfse/req-1",
    });
    expect(n.body).toContain("Falta o e-mail do tomador");
    const sim = buildFiscalNotice("authorized_simulated", "req-1");
    expect(sim.type).toBe("fiscal_request.processed");
    expect(sim.body).toMatch(/SIMULAÇÃO/);
    expect(sim.body).toMatch(/Nenhuma nota foi emitida/);
  });
});

describe("menu do Admin", () => {
  const items = [
    { href: "/admin/empresas", label: "Empresas", icon: Building2 },
    {
      href: "/admin/nfse",
      label: "NFS-e",
      icon: FileText,
      feature: "wjb_ai" as const,
    },
  ];
  it("esconde o item NFS-e com o módulo desligado ou sem permissão", () => {
    expect(visibleNavItems(items).map((i) => i.href)).toEqual([
      "/admin/empresas",
    ]);
    expect(visibleNavItems(items, ["wjb_ai"]).map((i) => i.href)).toEqual([
      "/admin/empresas",
      "/admin/nfse",
    ]);
  });
});
