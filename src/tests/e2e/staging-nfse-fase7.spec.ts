import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs } from "./helpers/login";

/**
 * Fase 7 em STAGING (homologação Supabase real, login real de usuários
 * fictícios). Só roda via scripts/wjb-ai/homologacao-supabase/staging.sh.
 */
const enabled = process.env.HOMOLOG_STAGING === "1";
test.skip(!enabled, "Só no staging da homologação (staging.sh).");
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Staging roda só no projeto chromium.",
  );
});

const login = (browser: Browser, key: string) => loginAs(browser, key);

const run = Date.now().toString(36);
const service = `Consultoria fictícia F7 ${run}`;
let requestPath = "";

async function say(page: Page, text: string) {
  await page.getByLabel("Sua mensagem").fill(text);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
}

test("assistente por regras: coleta, confirma e cria o pedido pelo caminho validado", async ({
  browser,
}) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto("/portal/nfse/assistente");
  await expect(page.getByText(/não usa inteligência artificial/)).toBeVisible();
  await say(page, "Quero pedir uma nota");
  await expect(
    page.getByText("Qual serviço você prestou?", { exact: false }),
  ).toBeVisible();
  await say(page, service);
  await say(page, "99.999,00"); // acima do limite do perfil: vai para revisão do contador
  await say(page, "11/2026");
  await say(page, "529.982.247-25");
  await say(page, "Tomador Fictício F7");
  await expect(page.getByText(/Confira os dados/)).toBeVisible();
  await expect(page.getByText(/\*\*\*\.982\.247-\*\*/)).toBeVisible();
  await page.getByRole("button", { name: "Sim, pode registrar" }).click();
  await page.waitForURL(/\/portal\/nfse\/[0-9a-f-]{36}/);
  requestPath = new URL(page.url()).pathname;
  await expect(
    page.getByText(/Em revisão pelo contador/).first(),
  ).toBeVisible();
});

test("assistente não escolhe alíquota: encaminha ao contador", async ({
  browser,
}) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto("/portal/nfse/assistente");
  await say(page, "Qual alíquota de ISS eu uso?");
  await expect(page.getByText(/são com o contador da WJB/)).toBeVisible();
  await expect(
    page.getByText("Conversa encaminhada à equipe da WJB."),
  ).toBeVisible();
});

test("lista: filtro, busca e marca de simulação; prévia imprimível sem valor fiscal", async ({
  browser,
}) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto("/portal/nfse?status=revisao");
  await expect(
    page.getByRole("link", { name: "Com o contador" }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByLabel("Buscar por serviço, tomador ou competência").fill(run);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText(service)).toBeVisible();
  await expect(page.getByText("1 solicitação(ões).")).toBeVisible();
  // Nenhuma linha diz "Autorizada" sem a marca de simulação.
  await page.goto("/portal/nfse?status=concluidas");
  await expect(page.getByText(/^Autorizada$/)).toHaveCount(0);
  await page.goto(`${requestPath}/previa`);
  await expect(page.getByText(/SIMULAÇÃO - SEM VALOR FISCAL/)).toBeVisible();
  await expect(
    page.getByText("***.982.247-**", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("52998224725")).toHaveCount(0);
});

test("prévia de pedido de outra empresa responde 404", async ({ browser }) => {
  const page = await login(browser, "CLIENTEB");
  const res = await page.goto(`${requestPath}/previa`);
  expect(res?.status()).toBe(404);
});

test("rascunho: recupera serviço e valor, nunca o documento do tomador", async ({
  browser,
}) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto("/portal/nfse/nova");
  await page
    .getByLabel("Descrição do serviço prestado")
    .fill("Rascunho fictício");
  await page.getByLabel("Valor do serviço (R$)").fill("12,34");
  await page.getByLabel("CPF ou CNPJ").fill("529.982.247-25");
  await page.reload();
  await page.getByRole("button", { name: "Recuperar rascunho" }).click();
  await expect(page.getByLabel("Descrição do serviço prestado")).toHaveValue(
    "Rascunho fictício",
  );
  await expect(page.getByLabel("Valor do serviço (R$)")).toHaveValue("12,34");
  await expect(page.getByLabel("CPF ou CNPJ")).toHaveValue("");
  const stored = await page.evaluate(() =>
    JSON.stringify(Object.entries(window.sessionStorage)),
  );
  expect(stored).not.toContain("52998224725");
});

test("contador: atribui a revisão a si, prioriza e vê o prazo; filtro 'minhas'", async ({
  browser,
}) => {
  const page = await login(browser, "CONTADOR");
  const id = requestPath.split("/").pop();
  await page.goto(`/admin/nfse/${id}`);
  await expect(
    page.getByRole("heading", { name: "Atribuição e prazo" }),
  ).toBeVisible();
  await page
    .getByLabel("Responsável")
    .selectOption({ label: "Contador Autorizado" });
  await page
    .getByLabel("Prioridade (define o prazo da revisão)")
    .selectOption("urgente");
  await page.getByRole("button", { name: "Salvar atribuição" }).click();
  await expect(
    page.getByText("Atribuição e prioridade atualizadas."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(/prioridade urgente · prazo/)).toBeVisible();
  await page.goto("/admin/nfse?fila=revisao&minhas=1");
  await expect(page.getByText(service)).toBeVisible();
  await expect(page.getByText("Urgente").first()).toBeVisible();
});

test("atendimento vê a atribuição mas não pode alterá-la", async ({
  browser,
}) => {
  const page = await login(browser, "ATENDIMENTO");
  const id = requestPath.split("/").pop();
  await page.goto(`/admin/nfse/${id}`);
  await expect(
    page.getByRole("heading", { name: "Atribuição e prazo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salvar atribuição" }),
  ).toHaveCount(0);
});
