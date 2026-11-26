import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/login";

/**
 * Fase 10B em STAGING (homologação real, usuários fictícios): rótulo único
 * de simulação e portão de transmissão oficial bloqueado, vistos na tela e
 * na API. Só via staging.sh.
 */
const enabled = process.env.HOMOLOG_STAGING === "1" && !process.env.HOMOLOG_PAYMENTS;
test.skip(!enabled, "Só no staging da homologação (staging.sh).");
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Staging roda só no projeto chromium.");
});

const LABEL = "SIMULAÇÃO - SEM VALOR FISCAL";

test("Admin: rótulo de simulação nas 3 telas e portão da transmissão oficial bloqueado com os motivos", async ({ browser }) => {
  const page = await loginAs(browser, "CONTADOR");
  for (const url of ["/admin/nfse", "/admin/nfse/perfis", "/admin/nfse/permissoes"]) {
    await page.goto(url);
    await expect(page.getByText(LABEL).first(), url).toBeVisible();
  }
  await page.goto("/admin/nfse");
  const gate = page.getByRole("region", { name: "Transmissão oficial (produção restrita)" });
  await expect(gate.getByText("Bloqueada", { exact: true })).toBeVisible();
  for (const motivo of [
    /Interruptor de transmissão oficial desligado/,
    /Contrato da API não conferido/,
    /Algoritmo de assinatura não confirmado/,
    /Cofre de certificados não configurado/,
    /Cadeia ICP-Brasil não configurada/,
    /Verificação de revogação não configurada/,
  ])
    await expect(gate.getByText(motivo)).toBeVisible();
  await expect(gate.getByRole("button")).toHaveCount(0); // nada libera pela tela
});

test("Portal e API de prévia: rótulo único e sem valor fiscal", async ({ browser }) => {
  const page = await loginAs(browser, "CLIENTEA");
  await page.goto("/portal/nfse");
  await expect(page.getByText(LABEL).first()).toBeVisible();
  const r = await page.request.post("/api/wjb-ai/fiscal/drafts/preview", {
    data: {
      serviceDescription: "Consultoria fictícia de teste da Fase 10B",
      grossAmount: "123.45",
      competence: "2026-11",
      taker: { document: "11222333000181", name: "Tomador Fictício Ltda" },
    },
  });
  const body = await r.json();
  expect(r.status(), JSON.stringify(body).slice(0, 200)).toBe(200);
  expect(body).toMatchObject({ simulated: true, transmitted: false, fiscalValue: false, notice: LABEL });
  expect(JSON.stringify(body)).not.toContain("11222333000181");
});
