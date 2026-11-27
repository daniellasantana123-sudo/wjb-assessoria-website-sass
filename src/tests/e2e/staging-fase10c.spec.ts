import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/login";

/**
 * Fase 10C em STAGING (homologação real, usuários fictícios): tela de
 * certificados (registro, bloqueios, formulário só do super admin) e campo
 * opcional do destinatário (indDest) no pedido do Portal. Só via staging.sh.
 * Nenhum bloqueio é gravado aqui: a lista é permanente.
 */
const enabled = process.env.HOMOLOG_STAGING === "1" && !process.env.HOMOLOG_PAYMENTS;
test.skip(!enabled, "Só no staging da homologação (staging.sh).");
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Staging roda só no projeto chromium.");
});

test("Admin: certificados com marcos de vencimento; formulário de bloqueio só para super admin", async ({ browser }) => {
  const contador = await loginAs(browser, "CONTADOR");
  await contador.goto("/admin/nfse/certificados");
  await expect(contador.getByRole("heading", { name: "Certificados digitais" })).toBeVisible();
  await expect(contador.getByText(/90, 60, 30, 15, 7 dias/)).toBeVisible();
  await expect(contador.getByText(/data de emissão sozinha não comprova/)).toBeVisible();
  await expect(contador.getByRole("heading", { name: "Bloqueios permanentes" })).toBeVisible();
  await expect(contador.getByRole("heading", { name: "Bloquear certificado" })).toHaveCount(0);
  await expect(contador.getByRole("link", { name: "Certificados" })).toHaveAttribute("aria-current", "page");

  const sa = await loginAs(browser, "SUPERADMIN");
  await sa.goto("/admin/nfse/certificados");
  const form = sa.getByRole("heading", { name: "Bloquear certificado" });
  await expect(form).toBeVisible();
  // Validações do servidor, sem gravar nada: formato e confirmação.
  await sa.getByLabel("Impressão digital SHA-256").fill("nao-e-uma-impressao-digital");
  await sa.getByLabel("Digite BLOQUEAR para confirmar").fill("BLOQUEAR");
  await sa.getByRole("button", { name: "Bloquear permanentemente" }).click();
  await expect(sa.getByText(/64 caracteres hexadecimais/)).toBeVisible();
  await sa.getByLabel("Impressão digital SHA-256").fill("ab".repeat(32));
  await sa.getByLabel("Digite BLOQUEAR para confirmar").fill("talvez");
  await sa.getByRole("button", { name: "Bloquear permanentemente" }).click();
  await expect(sa.getByText(/Digite BLOQUEAR para confirmar: o bloqueio é permanente/)).toBeVisible();
});

test("Portal: destinatário do serviço é opcional e nunca presumido; o contador vê o que foi declarado", async ({ browser }) => {
  const page = await loginAs(browser, "CLIENTEA");
  await page.goto("/portal/nfse/nova");
  const field = page.getByLabel("Quem recebe o serviço é o próprio tomador? (opcional)");
  await expect(field).toBeVisible();
  await expect(field).toHaveValue("");
  const r = await page.request.post("/api/wjb-ai/fiscal/drafts/preview", {
    data: {
      serviceDescription: "Consultoria fictícia de teste da Fase 10C",
      grossAmount: "10.00",
      competence: "2026-11",
      taker: { document: "11222333000181", name: "Tomador Fictício Ltda" },
      recipientIsTaker: true,
    },
  });
  expect(r.status()).toBe(200);
  const bad = await page.request.post("/api/wjb-ai/fiscal/drafts/preview", {
    data: {
      serviceDescription: "Consultoria fictícia de teste da Fase 10C",
      grossAmount: "10.00",
      competence: "2026-11",
      taker: { document: "11222333000181", name: "Tomador Fictício Ltda" },
      recipientIsTaker: "sim",
    },
  });
  expect(bad.status()).toBe(422); // schema estrito: só booleano
});
