import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Fase 8 em STAGING (homologação Supabase real, login real de usuários
 * fictícios, comercialização e WhatsApp SIMULADOS). Só via staging.sh.
 */
const enabled = process.env.HOMOLOG_STAGING === "1";
test.skip(!enabled, "Só no staging da homologação (staging.sh).");
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Staging roda só no projeto chromium.");
});

const user = (key: string) => ({ email: process.env[`HOMOLOG_USER_${key}`] ?? "", password: process.env[`HOMOLOG_PW_${key}`] ?? "" });
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

async function contract(page: Page, planName: string) {
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: planName, exact: true }) });
  await card.locator("summary", { hasText: "Contratar (simulação)" }).click();
  for (const box of await card.getByRole("checkbox").all()) await box.check();
  await card.getByRole("button", { name: "Contratar em simulação" }).click();
}

test("cliente de contabilidade contrata emissão (combo) com desconto, sem cobrança", async ({ browser }) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto("/portal/plano");
  await expect(page.getByText(/Os valores são os aprovados pela WJB/)).toBeVisible();
  await expect(page.getByText(/20% de desconto/)).toBeVisible();
  // Sem marcar os aceites o navegador nem envia; com aceites, contrata.
  await contract(page, "MEI Digital");
  await page.waitForURL(/\/portal\/plano\?contratado=1/);
  await expect(page.getByRole("status").filter({ hasText: /contratado em SIMULAÇÃO\. Nenhuma cobrança/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "MEI Digital" })).toBeVisible();
  await expect(page.getByText("Ativa (simulação)")).toBeVisible();
  await expect(page.getByText(/Notas no ciclo: \d+ de 10/)).toBeVisible();
  await expect(page.getByText(/Desconto cliente de contabilidade/)).toBeVisible();
  await expect(page.getByText(/SIMULAÇÃO: nenhuma cobrança é feita/)).toBeVisible();
  await expect(page.getByText("Aceites registrados")).toBeVisible();
});

test("excedente só com autorização e limite; troca de plano agendada", async ({ browser }) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto("/portal/plano");
  await page.getByLabel("Autorizo notas além da franquia").check();
  await page.getByLabel("Limite de gasto com excedente no mês (R$)").fill("39,00");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText(/Excedente autorizado/)).toBeVisible();
  await page.getByLabel("Novo plano (vale no próximo ciclo)").selectOption("nfse_profissional");
  await page.getByRole("button", { name: "Agendar troca" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Troca para Profissional agendada/ })).toBeVisible();
  await expect(page.getByText("Há uma troca agendada para o próximo ciclo.")).toBeVisible();
});

test("empresa sem contabilidade contrata só a emissão e não vê o plano da outra", async ({ browser }) => {
  const page = await login(browser, "CLIENTEB");
  await page.goto("/portal/plano");
  await expect(page.getByText(/de desconto/)).toHaveCount(0);
  await contract(page, "Nota Avulsa");
  await page.waitForURL(/contratado=1/);
  await expect(page.getByText(/Nota Avulsa contratado em SIMULAÇÃO/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Nota Avulsa" })).toBeVisible();
  // O plano da empresa A (MEI Digital) não aparece como plano ativo da B.
  await expect(page.getByRole("heading", { name: "MEI Digital" })).toHaveCount(0);
  await expect(page.getByText(/desconto de cliente de contabilidade/)).toHaveCount(0);
});

test("super admin vê assinaturas, suspende e o cliente perde o acesso na hora", async ({ browser }) => {
  const admin = await login(browser, "SUPERADMIN");
  await admin.goto("/admin/comercial");
  await expect(admin.getByText("Simulação: preços aprovados, sem cobrança")).toBeVisible();
  const rowB = admin.getByRole("listitem").filter({ hasText: "Empresa Ficticia B · nfse_avulsa" });
  await rowB.getByRole("button", { name: "Suspender" }).click();
  await expect(admin.getByText(/Assinatura suspensa/)).toBeVisible();
  const client = await login(browser, "CLIENTEB");
  await client.goto("/portal/plano");
  await expect(client.getByText("Suspensa")).toBeVisible();
});

test("contador vê o comercial só para leitura", async ({ browser }) => {
  const page = await login(browser, "CONTADOR");
  await page.goto("/admin/comercial");
  await expect(page.getByText(/Somente leitura/)).toBeVisible();
  await expect(page.locator("summary", { hasText: "Editar" })).toHaveCount(0);
});

test("landing com pré-cadastro e telefone opcional", async ({ page }) => {
  await page.goto("/emissao-de-notas");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("notas de serviço");
  await page.getByLabel("Nome").fill("Fulana Fictícia F8");
  await page.getByLabel("E-mail").fill(`f8-${Date.now()}@exemplo.test`);
  await page.getByLabel(/Concordo com o uso destes dados/).check();
  await page.getByRole("button", { name: "Entrar na lista de interesse" }).click();
  await expect(page.getByText(/Você está na lista de interesse/)).toBeVisible();
});

test("WhatsApp é só Click-to-Chat: não existe webhook nem API de mensagens", async ({ request, browser }) => {
  for (const method of ["get", "post"] as const) {
    const res = await request[method]("/api/wjb-ai/whatsapp/webhook");
    expect(res.status()).toBe(404);
  }
  const page = await login(browser, "ATENDIMENTO");
  await page.goto("/admin/whatsapp");
  await expect(page.getByText("Click-to-Chat (sem API de mensagens)")).toBeVisible();
  await expect(page.getByText("(11) 9 7614-6375", { exact: false })).toBeVisible();
});

test("consumo simulado da fila entra no ledger como NÃO faturável", async () => {
  const admin = createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
  const { data } = await admin.from("commercial_usage_ledger").select("kind, billable").eq("kind", "simulada").limit(50);
  expect((data ?? []).length).toBeGreaterThan(0);
  expect((data ?? []).every((r) => r.billable === false)).toBe(true);
});
