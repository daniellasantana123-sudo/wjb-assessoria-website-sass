import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs } from "./helpers/login";

/**
 * F3 em STAGING (homologação Supabase real, login real, conector SIMULADO).
 * Só roda via scripts/wjb-ai/homologacao-supabase/staging.sh.
 */
test.skip(process.env.HOMOLOG_STAGING !== "1", "Só no staging da homologação (staging.sh).");
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Staging roda só no projeto chromium.");
});

const login = (browser: Browser, key: string) => loginAs(browser, key);
const tenantSection = (page: Page, name: string) => page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
const run = Date.now().toString(36);

test("super admin concede fiscal_profile.approve ao contador", async ({ browser }) => {
  const page = await login(browser, "SUPERADMIN");
  await page.goto("/admin/nfse/permissoes");
  await page.getByLabel("Contador").selectOption({ label: "Contador Autorizado" });
  await page.getByLabel("Motivo", { exact: true }).fill("Contador responsável pela carteira (E2E)");
  await page.getByRole("button", { name: "Conceder" }).click();
  await expect(page.getByText(/Permissão concedida\.|Já existe uma concessão ativa igual\./)).toBeVisible();
});

// Fase 10A: este contador também não tem MFA, então é barrado antes pelo
// step-up. A checagem da concessão no banco segue coberta pelo run.sh e pela API.
test("contador sem concessão e sem MFA não consegue aprovar perfil", async ({ browser }) => {
  const page = await login(browser, "CONTADORSEM");
  await page.goto("/admin/nfse/perfis");
  const a = tenantSection(page, "Empresa Ficticia A");
  await a.getByLabel("Limite por nota sem revisão (R$)").fill("1.000,00");
  await a.getByRole("button", { name: "Criar rascunho de perfil" }).click();
  await expect(a.getByText(/Rascunho versão \d+ criado\./)).toBeVisible();
  await page.reload();
  const draft = tenantSection(page, "Empresa Ficticia A").getByRole("listitem").filter({ hasText: "Rascunho" }).first();
  await draft.getByLabel("Justificativa da aprovação").fill("Tentativa sem a permissão (E2E)");
  await draft.getByRole("button", { name: "Aprovar perfil" }).click();
  await expect(draft.getByText(/Esta ação exige a verificação em duas etapas/)).toBeVisible();
});

test("contador preenche o cadastro fiscal completo no rascunho e vê a prontidão", async ({ browser }) => {
  const page = await login(browser, "CONTADOR");
  await page.goto("/admin/nfse/perfis");
  const a = tenantSection(page, "Empresa Ficticia A");
  await expect(a.getByText("Prontidão para emitir")).toBeVisible();
  const draft = a.getByRole("listitem").filter({ hasText: "Rascunho" }).first();
  await draft.locator("summary", { hasText: "Preencher cadastro fiscal" }).click();
  await draft.getByLabel("Enquadramento").selectOption("SIMPLES_ME_EPP");
  await draft.getByLabel("Emitente: CPF/CNPJ").fill("00000000000191");
  await draft.getByLabel("Município emissor (IBGE, 7 dígitos)").fill("3550308");
  await draft.getByLabel(/^Código de tributação nacional/).fill("010101");
  await draft.getByLabel("Local da prestação (IBGE, 7 dígitos)").fill("3550308");
  await draft.getByLabel("Situação perante o Simples (opSimpNac)").selectOption("3");
  await draft.getByLabel("Regime especial (regEspTrib)").selectOption("0");
  await draft.getByLabel("Tributação do ISSQN (tribISSQN)").selectOption("1");
  await draft.getByLabel("Retenção do ISSQN (tpRetISSQN)").selectOption("1");
  await draft.getByLabel("Regime de apuração no Simples (regApTribSN)").selectOption("1");
  await draft.getByLabel("Convênio do município de incidência no Sistema Nacional").selectOption("sim");
  await draft.getByLabel("Convênio conferido em").fill("2026-11-18");
  await draft.getByLabel("IBS/CBS na DPS").selectOption("nao_informar");
  await draft.getByLabel("Justificativa da decisão de IBS/CBS").fill("Grupo opcional hoje; decisão fictícia do contador.");
  await draft.getByLabel("Série da DPS (1 a 49999)").fill("70000");
  await draft.getByRole("button", { name: "Salvar cadastro fiscal" }).click();
  // Série fora da faixa do canal API é recusada com mensagem clara.
  await expect(draft.getByRole("alert")).toContainText("Série da DPS (1 a 49999)");
  // O erro não apaga o que já foi preenchido: só a série é corrigida.
  await expect(draft.getByLabel("Código de tributação nacional (cTribNac, 6 dígitos)")).toHaveValue("010101");
  await draft.getByLabel("Série da DPS (1 a 49999)").fill("1");
  await draft.getByRole("button", { name: "Salvar cadastro fiscal" }).click();
  await expect(a.getByText(/Cadastro fiscal salvo no rascunho versão/)).toBeVisible();
});

test("contador autorizado aprova o perfil e registra a autorização de emissão", async ({ browser }) => {
  const page = await login(browser, "CONTADOR");
  await page.goto("/admin/nfse/perfis");
  const draft = tenantSection(page, "Empresa Ficticia A").getByRole("listitem").filter({ hasText: "Rascunho" }).first();
  await draft.getByLabel("Justificativa da aprovação").fill(`Conferido com documentos fictícios (E2E ${run})`);
  await draft.getByRole("button", { name: "Aprovar perfil" }).click();
  // O item deixa de ser rascunho: conferimos o registro da aprovação (quem e justificativa).
  await expect(
    tenantSection(page, "Empresa Ficticia A").getByText(new RegExp(`Aprovado por Contador Autorizado .*\\(E2E ${run}\\)`)),
  ).toBeVisible();
  const a = tenantSection(page, "Empresa Ficticia A");
  await a.locator("summary", { hasText: "Registrar autorização" }).click();
  await a.getByLabel("Autorização válida até").fill("2027-12-31");
  await a.getByLabel("Escopo").fill("Emissão de NFS-e de serviços (fictícia)");
  await a.getByLabel("Onde está a evidência").fill("Pasta fictícia de homologação");
  await a.getByLabel("CNPJ/CPF do titular do certificado").fill("00000000000272");
  await a.getByRole("button", { name: "Registrar autorização" }).click();
  await expect(a.getByText("Autorização registrada.")).toBeVisible();
  // Modelo A sem certificado da WJB no cofre: a prontidão mostra o bloqueio.
  await expect(a.getByText(/certificado da WJB não cadastrado no cofre/).first()).toBeVisible();
});

async function request(page: Page, amount: string, ref: string) {
  await page.goto("/portal/nfse/nova");
  await page.getByLabel("Descrição do serviço prestado").fill(`Serviço fictício F3 ${ref}`);
  await page.getByLabel("Valor do serviço (R$)").fill(amount);
  await page.getByLabel("CPF ou CNPJ").fill("529.982.247-25");
  await page.getByLabel("Nome ou razão social").fill("Tomador Fictício");
  await page.getByLabel("Referência interna (opcional)").fill(ref);
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await page.getByRole("button", { name: "Confirmar e enviar solicitação" }).click();
  await page.waitForURL(/\/portal\/nfse\/[0-9a-f-]{36}/);
  return new URL(page.url()).pathname.split("/").pop()!;
}
let okId = "";
let reviewId = "";

test("cliente: dentro do limite fica confirmada; acima do limite vai para revisão", async ({ browser }) => {
  const page = await login(browser, "CLIENTEA");
  okId = await request(page, "80,13", `f3-ok-${run}`);
  await expect(page.getByText("Confirmada, aguardando envio").first()).toBeVisible();
  reviewId = await request(page, "1.500,66", `f3-rev-${run}`);
  await expect(page.getByText("Em revisão pelo contador").first()).toBeVisible();
  await expect(page.getByText("O valor está acima do limite definido para seguir sem revisão.")).toBeVisible();
});

test("atendimento vê a fila mas não decide", async ({ browser }) => {
  const page = await login(browser, "ATENDIMENTO");
  await page.goto(`/admin/nfse/${reviewId}`);
  await expect(page.getByRole("heading", { name: "Histórico completo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar decisão" })).toHaveCount(0);
});

test("contador revisa, aprova e autoriza o envio simulado dos dois pedidos", async ({ browser }) => {
  const page = await login(browser, "CONTADOR");
  await page.goto(`/admin/nfse/${reviewId}`);
  await page.getByLabel("Observação (obrigatória para pedir correção ou bloquear; o cliente vê)").fill("Valor conferido com o contrato fictício");
  await page.getByRole("button", { name: "Registrar decisão" }).click();
  // A página volta com o novo status; o formulário de revisão sai de cena.
  await expect(page.getByText("Revisado pelo contador: Valor conferido com o contrato fictício")).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar decisão" })).toHaveCount(0);
  for (const id of [reviewId, okId]) {
    await page.goto(`/admin/nfse/${id}`);
    await page.getByRole("button", { name: "Autorizar envio simulado" }).click();
    await expect(page.getByText("Envio autorizado pelo contador (conector SIMULADO).")).toBeVisible();
  }
});

test("fila simulada processa: indeterminado conciliado e rejeição simulada", async ({ request: api }) => {
  const res = await api.post("/api/wjb-ai/cron/processar-fila", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, simulated: true });
  expect(body.authorized).toBeGreaterThanOrEqual(1);
  expect(body.rejected).toBeGreaterThanOrEqual(1);
  const denied = await api.post("/api/wjb-ai/cron/processar-fila", { headers: { authorization: "Bearer errado" } });
  expect(denied.status()).toBe(401);
});

test("cliente vê autorizada EM SIMULAÇÃO, sem valor fiscal, e a rejeição", async ({ browser }) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto(`/portal/nfse/${okId}`);
  await expect(page.getByText("Autorizada em simulação")).toBeVisible();
  await expect(page.getByText(/esta nota não foi emitida e não tem valor fiscal/)).toBeVisible();
  await expect(page.getByText("Conferindo retorno").first()).toBeVisible();
  await page.goto(`/portal/nfse/${reviewId}`);
  await expect(page.getByText("Rejeitada").first()).toBeVisible();
});

let correctionId = "";
test("contador pede correção: cliente recebe aviso, corrige o mesmo pedido e o histórico é mantido", async ({ browser }) => {
  const client = await login(browser, "CLIENTEA");
  correctionId = await request(client, "2.000,00", `f3-corr-${run}`);
  await expect(client.getByText("Em revisão pelo contador").first()).toBeVisible();

  const staff = await login(browser, "CONTADOR");
  await staff.goto(`/admin/nfse/${correctionId}`);
  await staff.getByLabel("Decisão").selectOption("request_data");
  await staff.getByLabel("Observação (obrigatória para pedir correção ou bloquear; o cliente vê)").fill("Informe o e-mail do tomador fictício");
  await staff.getByRole("button", { name: "Registrar decisão" }).click();
  await expect(staff.getByText("Correção pedida: Informe o e-mail do tomador fictício")).toBeVisible();

  await client.goto("/portal/notificacoes");
  await expect(client.getByText(/A WJB pediu uma correção na sua solicitação de NFS-e\. Motivo: Informe o e-mail do tomador fictício/).first()).toBeVisible();

  await client.goto(`/portal/nfse/${correctionId}`);
  await client.getByRole("link", { name: "Corrigir solicitação" }).click();
  await expect(client.getByText("Correção pedida: Informe o e-mail do tomador fictício")).toBeVisible();
  await expect(client.getByLabel("Nome ou razão social")).toHaveValue("Tomador Fictício");
  await client.getByLabel("E-mail do tomador (opcional)").fill("tomador@exemplo.test");
  await client.getByRole("button", { name: "Ver prévia" }).click();
  await client.getByRole("button", { name: "Confirmar correção" }).click();
  await client.waitForURL(new RegExp(`/portal/nfse/${correctionId}\\?corrigida=1`));
  await expect(client.getByText("Correção registrada. A versão anterior foi guardada no histórico.")).toBeVisible();
  await expect(client.getByText(/foi corrigida 1 vez/)).toBeVisible();
  // O histórico completo continua: pedido original, correção pedida e nova triagem.
  await expect(client.getByText("Encaminhado para revisão do contador.").first()).toBeVisible();
  await expect(client.getByText("Cliente corrigiu os dados pedidos pelo contador.")).toBeVisible();
});

test("menu do Admin mostra NFS-e só com o módulo ligado", async ({ browser }) => {
  const staff = await login(browser, "ATENDIMENTO");
  await staff.goto("/admin");
  await expect(staff.getByRole("navigation", { name: "Navegação do Admin" }).getByRole("link", { name: "NFS-e (simulação)" })).toBeVisible();
});

test("rotina de alertas exige o segredo e responde só contagens", async ({ request: api }) => {
  const denied = await api.post("/api/wjb-ai/cron/alertas", { headers: { authorization: "Bearer errado" } });
  expect(denied.status()).toBe(401);
  const res = await api.post("/api/wjb-ai/cron/alertas", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ ok: true });
  expect(typeof body.total).toBe("number");
  expect(JSON.stringify(body)).not.toMatch(/\d{11,14}|@/);
});
