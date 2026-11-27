import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { auditEntry, planCancellation, planSubstitution, type IssuedNote } from "@/lib/wjb-ai/fiscal/cancellation";
import { LAYOUT_CONTRACTS } from "@/lib/wjb-ai/fiscal/national/layouts";

// Tudo fictício. Chave de acesso de 50 posições no formato do XSD.
const CLIENTE = "11222333000181";
const KEY = "35503082" + "2" + CLIENTE + "0".repeat(27);
const AUTH: IssuedNote = { status: "AUTORIZADA", simulated: false, accessKey: KEY };
const R2 = LAYOUT_CONTRACTS.find((l) => l.id === "producao-restrita-nt009-r2-20261124")!;
const hasXmllint = spawnSync("xmllint", ["--version"], { stdio: "ignore" }).status === 0;
const codes = (r: { ok: boolean; blockers?: { code: string }[] }) => (r.ok ? [] : r.blockers!.map((b) => b.code));
const cancel = (over: Partial<Parameters<typeof planCancellation>[0]> = {}) =>
  planCancellation({
    note: AUTH,
    environment: "producao_restrita",
    author: { kind: "CNPJ", document: CLIENTE },
    reason: "2",
    description: "Serviço não prestado: pedido desfeito pelo cliente (teste)",
    at: new Date("2026-11-26T15:00:00-03:00"),
    ...over,
  });

describe("cancelamento: elegibilidade e validação (Fase 10D)", () => {
  it("nota oficial autorizada: pedido montado com o Id do padrão do XSD", () => {
    const r = cancel();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.eventId).toBe(`PRE${KEY}101101`);
      expect(r.xml).toContain("<cMotivo>2</cMotivo>");
    }
  });
  it.skipIf(!hasXmllint)("o pedido é válido no pedRegEvento oficial", () => {
    const r = cancel();
    if (!r.ok) throw new Error("plano");
    const dir = mkdtempSync(path.join(tmpdir(), "wjb-canc-"));
    writeFileSync(path.join(dir, "e.xml"), r.xml);
    const x = spawnSync("xmllint", ["--noout", "--schema", path.join(process.cwd(), R2.xsdDir, "pedRegEvento_v1.01.xsd"), path.join(dir, "e.xml")], { encoding: "utf8" });
    expect(`${x.stdout}${x.stderr}`).not.toMatch(/validity error/);
  });
  it("nota simulada, não autorizada, sem chave ou em produção: recusa com todos os motivos", () => {
    expect(codes(cancel({ note: { ...AUTH, simulated: true } }))).toContain("EVENT_NOTE_SIMULATED");
    expect(codes(cancel({ note: { ...AUTH, status: "REJEITADA" } }))).toContain("EVENT_NOTE_NOT_AUTHORIZED");
    expect(codes(cancel({ note: { ...AUTH, accessKey: null } }))).toContain("EVENT_NO_ACCESS_KEY");
    expect(codes(cancel({ environment: "producao" }))).toContain("EVENT_PRODUCTION_BLOCKED");
    expect(codes(cancel({ note: { status: "AUTORIZADA_PARA_ENVIO", simulated: true, accessKey: null } }))).toHaveLength(3);
  });
  it("motivo fora da tabela e descrição fora do tamanho viram bloqueios, não exceção", () => {
    expect(codes(cancel({ reason: "3" }))).toContain("EVENT_REASON_INVALID");
    expect(codes(cancel({ description: "curta" }))).toContain("EVENT_INPUT_INVALID");
  });
  it("trilha de auditoria: só códigos e motivo oficial, nunca a descrição nem documentos", () => {
    const ok = auditEntry("cancelamento", cancel(), "2");
    const no = auditEntry("cancelamento", cancel({ note: { ...AUTH, simulated: true } }), "2");
    expect(ok).toEqual({ action: "fiscal.cancellation_prepared", metadata: { reason: "2" } });
    expect(no.action).toBe("fiscal.cancellation_blocked");
    expect(JSON.stringify([ok, no])).not.toMatch(/Serviço não prestado|11222333000181|\d{11,}/);
  });
});

describe("substituição: elegibilidade e validação (Fase 10D)", () => {
  it("nota autorizada + motivo oficial: grupo subst pronto para a DPS substituta", () => {
    expect(planSubstitution({ note: AUTH, environment: "producao_restrita", reason: "99", description: "Correção do valor do serviço (teste)" })).toEqual({
      ok: true,
      substitution: { accessKey: KEY, reason: "99", description: "Correção do valor do serviço (teste)" },
    });
    expect(planSubstitution({ note: AUTH, environment: "producao_restrita", reason: "01" })).toMatchObject({ ok: true });
  });
  it("recusa nota simulada, motivo fora da tabela e descrição curta", () => {
    expect(codes(planSubstitution({ note: { ...AUTH, simulated: true }, environment: "producao_restrita", reason: "01" }))).toContain("EVENT_NOTE_SIMULATED");
    expect(codes(planSubstitution({ note: AUTH, environment: "producao_restrita", reason: "1" }))).toContain("SUBST_REASON_INVALID");
    expect(codes(planSubstitution({ note: AUTH, environment: "producao_restrita", reason: "99", description: "curta" }))).toContain("SUBST_DESCRIPTION_LENGTH");
    expect(auditEntry("substituicao", planSubstitution({ note: AUTH, environment: "producao", reason: "01" }), "01").action).toBe("fiscal.substitution_blocked");
  });
});
