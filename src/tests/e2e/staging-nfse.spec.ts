import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * F2 em STAGING (homologação Supabase real, login real de usuários
 * fictícios). Só roda via scripts/wjb-ai/homologacao-supabase/staging.sh,
 * que liga o módulo apenas nesse build local e nunca aponta para produção.
 */
const enabled = process.env.HOMOLOG_STAGING === "1";
test.skip(!enabled, "Só no staging da homologação (staging.sh).");
test.describe.configure({ mode: "serial" });
// Um projeto só: logins simultâneos com a mesma conta colidem no Supabase Auth.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Staging roda só no projeto chromium.");
});

const user = (key: string) => ({
  email: process.env[`HOMOLOG_USER_${key}`] ?? "",
  password: process.env[`HOMOLOG_PW_${key}`] ?? "",
});

async function login(browser: Browser, key: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(() => window.localStorage.setItem("wjb-cookie-consent", "declined"));
  const page = await context.newPage();
  const u = user(key);
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(portal|admin)/);
  return page;
}

async function fillForm(page: Page, ref: string) {
  await page.getByLabel("Descrição do serviço prestado").fill("Serviço fictício de homologação");
  await page.getByLabel("Valor do serviço (R$)").fill("80,00");
  await page.getByLabel("CPF ou CNPJ").fill("529.982.247-25");
  await page.getByLabel("Nome ou razão social").fill("Tomador Fictício");
  await page.getByLabel("Referência interna (opcional)").fill(ref);
}

const ref = `e2e-${Date.now()}`;
let requestUrl = "";

test("cliente solicita NFS-e: prévia, confirmação e andamento em revisão", async ({ browser }) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto("/portal/nfse/nova");
  await expect(page.getByText("Empresa emitente:")).toBeVisible();
  await fillForm(page, ref);
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByText("Prévia da solicitação (simulação)")).toBeVisible();
  await expect(page.getByText(/\*\*\*4725/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar e enviar solicitação" }).click();
  await page.waitForURL(/\/portal\/nfse\/[0-9a-f-]{36}/);
  requestUrl = new URL(page.url()).pathname;
  await expect(page.getByText("Em revisão pelo contador").first()).toBeVisible();
  await expect(page.getByText("Encaminhado para revisão do contador.")).toBeVisible();
  await expect(page.getByText(/emitid/i)).toHaveCount(0);

  await page.goto("/portal/nfse");
  await expect(page.getByText("Serviço fictício de homologação").first()).toBeVisible();
});

test("o mesmo pedido de novo devolve o existente, sem duplicar", async ({ browser }) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto("/portal/nfse/nova");
  await fillForm(page, ref);
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await page.getByRole("button", { name: "Confirmar e enviar solicitação" }).click();
  await page.waitForURL(/duplicada=1/);
  expect(new URL(page.url()).pathname).toBe(requestUrl);
  await expect(page.getByText("Esta solicitação já tinha sido registrada.")).toBeVisible();
});

test("cliente de outra empresa não abre o pedido (404)", async ({ browser }) => {
  const page = await login(browser, "CLIENTEB");
  const res = await page.goto(requestUrl);
  expect(res?.status()).toBe(404);
});

test("trocar a empresa ativa depois da prévia invalida a confirmação", async ({ browser }) => {
  const page = await login(browser, "CLIENTEAB");
  await page.goto("/portal/nfse/nova");
  await fillForm(page, `${ref}-troca`);
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByText("Prévia da solicitação (simulação)")).toBeVisible();
  // Troca a empresa ativa em outra aba da mesma sessão.
  const other = await page.context().newPage();
  await other.goto("/portal");
  const select = other.locator('select[name="tenantId"]:visible').first();
  const current = await select.inputValue();
  const target = await select.locator("option").evaluateAll(
    (opts, cur) => (opts as HTMLOptionElement[]).map((o) => o.value).find((v) => v !== cur),
    current,
  );
  await select.selectOption(target!);
  await other.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Confirmar e enviar solicitação" }).click();
  await expect(page.getByText(/empresa ativa mudou/i)).toBeVisible();
});

test("equipe WJB não usa a tela do cliente", async ({ browser }) => {
  const page = await login(browser, "CONTADOR");
  const res = await page.goto("/portal/nfse");
  expect(res?.status()).toBe(404);
});
