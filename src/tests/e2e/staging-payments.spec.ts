import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs } from "./helpers/login";

/**
 * Fase 9.1 em STAGING: pagamentos com o provedor SIMULADO (mesmo fluxo e
 * mesmo tratador de eventos da Stripe), homologação Supabase real, usuários
 * fictícios. Só via staging.sh, com WJB_PAYMENTS_PROVIDER=mock.
 */
const enabled = process.env.HOMOLOG_STAGING === "1" && process.env.HOMOLOG_PAYMENTS === "mock";
test.skip(!enabled, "Só no staging com pagamentos simulados (staging.sh).");
// Ações de pagamento simulado fazem várias chamadas seguidas ao Supabase de
// homologação (remoto, 200-800 ms cada em 26/11/2026). Os limites padrão
// (5 s por verificação, 30 s por teste) estouravam sem erro no fluxo.
const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ mode: "serial", timeout: 120_000 });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Staging roda só no projeto chromium.");
});

const admin = () => createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
const nb = (s: string) => s.replace(/ /g, " ");
let checkoutPathA = "";

const login = (browser: Browser, key: string) => loginAs(browser, key);
async function tenantId(name: string) {
  const { data } = await admin().from("tenants").select("id").eq("name", name).single();
  return data!.id as string;
}
async function startPayment(page: Page, planName: string, button: RegExp) {
  await page.goto("/portal/plano");
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: planName, exact: true }) });
  await card.locator("summary", { hasText: "Contratar (pagamento de teste)" }).click();
  for (const box of await card.getByRole("checkbox").all()) await box.check();
  await card.getByRole("button", { name: button }).click();
  await page.waitForURL(/\/portal\/plano\/checkout-simulado\/cs_mock_/);
}

test("combo: checkout com 20% calculado no servidor; cartão recusado não ativa; pagamento confirmado ativa e gera fatura", async ({ browser }) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto("/portal/plano");
  await expect(page.getByText("PAGAMENTO SIMULADO / AMBIENTE DE TESTE.")).toBeVisible();
  await startPayment(page, "MEI Digital", /Ir para o pagamento \(teste\)/);
  checkoutPathA = new URL(page.url()).pathname;
  expect(nb(await page.locator("main").innerText())).toContain("R$ 19,92");
  await page.getByRole("button", { name: "Simular cartão recusado" }).click();
  await expect(page.getByText(/Cartão recusado \(teste\)\. Nada foi ativado/)).toBeVisible();
  const A = await tenantId("Empresa Ficticia A");
  const { data: pending } = await admin().from("commercial_subscriptions").select("status").eq("tenant_id", A).neq("status", "cancelada").single();
  expect(pending!.status).toBe("pendente_pagamento");
  // Retorno de pagamento sem confirmação do servidor não ativa nada.
  await page.goto("/portal/plano?pagamento=retorno");
  await expect(page.getByText(/O plano é ativado quando o provedor confirmar/)).toBeVisible();
  await expect(page.getByText("Aguardando pagamento")).toBeVisible();
  await page.goto(checkoutPathA);
  await page.getByRole("button", { name: "Pagar (teste)" }).click();
  await page.waitForURL(/pagamento=retorno/);
  await expect(page.getByText("Pagamento confirmado (ambiente de teste). Seu plano está ativo.")).toBeVisible();
  await expect(page.getByText("Ativa (pagamento de teste)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Faturas (ambiente de teste)" })).toBeVisible();
  const faturas = page.getByRole("region", { name: /Faturas/ }).or(page.locator("section", { has: page.getByRole("heading", { name: "Faturas (ambiente de teste)" }) }));
  expect(nb(await faturas.first().innerText())).toMatch(/R\$ 19,92[\s\S]*Paga/);
  const { data: subs } = await admin().from("commercial_subscriptions").select("status, mode, discount_bp, provider_subscription_id").eq("tenant_id", A).neq("status", "cancelada");
  expect(subs).toHaveLength(1);
  expect(subs![0]).toMatchObject({ status: "ativa_teste", discount_bp: 2000 });
  expect(subs![0].provider_subscription_id).toMatch(/^sub_mock_/);
});

test("o mesmo checkout não ativa duas vezes nem gera segunda fatura; eventos sem falha", async ({ browser }) => {
  const page = await login(browser, "CLIENTEA");
  await page.goto(checkoutPathA);
  await expect(page.getByText("Este pagamento não está mais aberto.")).toBeVisible();
  const A = await tenantId("Empresa Ficticia A");
  const { data: open } = await admin().from("commercial_subscriptions").select("id").eq("tenant_id", A).neq("status", "cancelada");
  expect(open).toHaveLength(1);
  const { count: inv } = await admin().from("payment_invoices").select("provider_invoice_id", { count: "exact", head: true }).eq("subscription_id", open![0].id);
  expect(inv).toBe(1);
  const { data: ev } = await admin().from("payment_events").select("status").eq("tenant_id", A);
  expect((ev ?? []).every((e) => e.status === "processado")).toBe(true);
});

test("empresa B não abre o checkout da A", async ({ browser }) => {
  const page = await login(browser, "CLIENTEB");
  const res = await page.goto(checkoutPathA);
  expect(res?.status()).toBe(404);
});

test("troca de plano pago: mostra o valor proporcional antes e só cobra depois do aceite", async ({ browser }) => {
  const client = await login(browser, "CLIENTEA");
  await client.goto("/portal/plano");
  await client.getByLabel("Novo plano").selectOption("nfse_profissional");
  await client.getByRole("button", { name: "Ver valor da troca" }).click();
  await client.waitForURL(/troca=nfse_profissional/);
  const preview = client.getByRole("status").filter({ hasText: "Trocar para Profissional" });
  await expect(preview).toBeVisible();
  expect(nb(await preview.innerText())).toMatch(/cobrança agora de R\$ \d+,\d{2}/);
  const A = await tenantId("Empresa Ficticia A");
  const { data: before } = await admin().from("commercial_subscriptions").select("plan_sku").eq("tenant_id", A).neq("status", "cancelada").single();
  expect(before!.plan_sku).toBe("nfse_mei"); // só pré-visualizou
  await client.getByLabel("Concordo com a cobrança mostrada acima.").check();
  await client.getByRole("button", { name: "Confirmar troca" }).click();
  await client.waitForURL(/trocado=1/);
  await expect(client.getByText(/Plano trocado para Profissional/)).toBeVisible();
  const { data: after } = await admin().from("commercial_subscriptions").select("plan_sku, quota, discount_bp, status").eq("tenant_id", A).neq("status", "cancelada").single();
  expect(after).toMatchObject({ plan_sku: "nfse_profissional", quota: 50, discount_bp: 2000, status: "ativa_teste" });
});

test("renovação com falha deixa inadimplente (sem acesso); renovação paga reativa; estorno aparece na fatura", async ({ browser }) => {
  const sa = await login(browser, "SUPERADMIN");
  await sa.goto("/admin/pagamentos");
  await expect(sa.getByText("AMBIENTE DE TESTE · sem cobrança real")).toBeVisible();
  const row = sa.getByRole("listitem").filter({ hasText: "Empresa Ficticia A · nfse_profissional" });
  await row.getByLabel(/Evento simulado/).selectOption("renovacao_falhou");
  await row.getByRole("button", { name: "Simular evento" }).click();
  await expect(sa.getByRole("status").filter({ hasText: /renovacao_falhou": processado, processado/ })).toBeVisible();
  const client = await login(browser, "CLIENTEA");
  await client.goto("/portal/plano");
  await expect(client.getByText("Pagamento em atraso")).toBeVisible();
  await expect(client.getByRole("alert").filter({ hasText: "O pagamento da renovação falhou." })).toBeVisible();
  await sa.reload();
  await row.getByLabel(/Evento simulado/).selectOption("renovacao_paga");
  await row.getByRole("button", { name: "Simular evento" }).click();
  await expect(sa.getByRole("status").filter({ hasText: /renovacao_paga": processado, processado/ })).toBeVisible();
  await sa.reload();
  await row.getByLabel(/Evento simulado/).selectOption("estorno");
  await row.getByRole("button", { name: "Simular evento" }).click();
  await expect(sa.getByRole("status").filter({ hasText: /estorno": processado/ })).toBeVisible();
  await client.reload();
  await expect(client.getByText("Ativa (pagamento de teste)")).toBeVisible();
  await expect(client.getByText(/estornado R\$/).first()).toBeVisible(); // histórico mantém faturas anteriores
});

test("Fase 10F: reembolso parcial de teste pelo Admin, com confirmação e limite do saldo", async ({ browser }) => {
  const inicio = new Date(Date.now() - 1000).toISOString();
  const sa = await login(browser, "SUPERADMIN");
  await sa.goto("/admin/pagamentos");
  // Renovação paga gera uma fatura nova, já com a cobrança (cartão de teste) vinculada.
  const subRow = sa.getByRole("listitem").filter({ hasText: "Empresa Ficticia A · nfse_profissional" });
  await subRow.getByLabel(/Evento simulado/).selectOption("renovacao_paga");
  await subRow.getByRole("button", { name: "Simular evento" }).click();
  await expect(sa.getByRole("status").filter({ hasText: /renovacao_paga": processado/ })).toBeVisible();
  await sa.reload();
  const faturas = sa.locator("section[aria-labelledby=faturas]");
  const inv = faturas.getByRole("listitem").filter({ has: sa.locator("summary", { hasText: "Reembolsar (teste)" }) }).first();
  await inv.locator("summary", { hasText: "Reembolsar (teste)" }).click();
  // Sem a palavra de confirmação: nada é devolvido.
  await inv.getByLabel("Valor (R$)").fill("10,00");
  await inv.getByLabel("Digite REEMBOLSAR").fill("sim");
  await inv.getByRole("button", { name: "Reembolsar" }).click();
  await expect(inv.getByRole("alert").filter({ hasText: "Digite REEMBOLSAR para confirmar." })).toBeVisible();
  // Acima do saldo: recusado pela regra (o saldo vem do provedor, não do formulário).
  await inv.getByLabel("Valor (R$)").fill("99999,00");
  await inv.getByLabel("Digite REEMBOLSAR").fill("REEMBOLSAR");
  await inv.getByRole("button", { name: "Reembolsar" }).click();
  await expect(inv.getByRole("alert").filter({ hasText: "maior que o saldo" })).toBeVisible();
  // Parcial de R$ 10,00 (valor FICTÍCIO de teste).
  await inv.getByLabel("Valor (R$)").fill("10,00");
  await inv.getByLabel("Digite REEMBOLSAR").fill("REEMBOLSAR");
  await inv.getByRole("button", { name: "Reembolsar" }).click();
  await expect(sa.getByRole("status").filter({ hasText: "Reembolso de teste feito." })).toBeVisible();
  const { data: rows } = await admin().from("payment_invoices").select("amount_refunded_cents").eq("tenant_id", await tenantId("Empresa Ficticia A")).eq("amount_refunded_cents", 1000).gte("updated_at", inicio);
  baseExpect(rows?.length).toBe(1);
  const { data: logs } = await admin().from("audit_log").select("action, metadata").eq("action", "payments.refund_requested").gte("created_at", inicio).order("created_at", { ascending: false }).limit(1);
  baseExpect(logs?.[0]?.metadata).toMatchObject({ amount_cents: 1000, status: "succeeded", mode: "mock" });
  baseExpect(JSON.stringify(logs?.[0]?.metadata)).not.toMatch(/@|\d{11}/);
});

test("cancelamento pago agenda para o fim do período; cancelamento no provedor encerra", async ({ browser }) => {
  const client = await login(browser, "CLIENTEA");
  await client.goto("/portal/plano");
  await client.getByLabel(/O plano continua até o fim do período já pago/).check();
  await client.getByRole("button", { name: "Cancelar no fim do período" }).click();
  await expect(client.getByText(/Cancelamento agendado para o fim do período/)).toBeVisible();
  await client.reload();
  await expect(client.getByText(/Cancelamento agendado: o plano termina em/)).toBeVisible();
  const sa = await login(browser, "SUPERADMIN");
  await sa.goto("/admin/pagamentos");
  const row = sa.getByRole("listitem").filter({ hasText: "Empresa Ficticia A · nfse_profissional" });
  await row.getByLabel(/Evento simulado/).selectOption("cancelar_agora");
  await row.getByRole("button", { name: "Simular evento" }).click();
  await expect(sa.getByRole("status").filter({ hasText: /cancelar_agora": processado/ })).toBeVisible();
  await client.reload();
  await expect(client.getByRole("heading", { name: "Escolha um plano" })).toBeVisible();
});

test("desistir do pagamento libera a empresa e nada é cobrado", async ({ browser }) => {
  const client = await login(browser, "CLIENTEA");
  await startPayment(client, "Profissional", /Ir para o pagamento \(teste\)/);
  expect(nb(await client.locator("main").innerText())).toContain("R$ 55,92"); // 69,90 - 20%
  await client.getByRole("button", { name: "Desistir" }).click();
  await client.waitForURL(/pagamento=desistiu/);
  await expect(client.getByText("Tentativa de pagamento encerrada. Nada foi cobrado.")).toBeVisible();
  await expect(client.getByRole("heading", { name: "Escolha um plano" })).toBeVisible();
});

test("Nota Avulsa: só cadastra a forma de pagamento (nada cobrado) e empresa sem contabilidade não tem desconto", async ({ browser }) => {
  const B = await tenantId("Empresa Ficticia B");
  await admin().from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "teste E2E 9.1" }).eq("tenant_id", B).neq("status", "cancelada");
  const client = await login(browser, "CLIENTEB");
  await startPayment(client, "Nota Avulsa", /Cadastrar forma de pagamento \(teste\)/);
  await expect(client.getByText(/Nada é cobrado agora/)).toBeVisible();
  await client.getByRole("button", { name: "Cadastrar cartão (teste)" }).click();
  await client.waitForURL(/pagamento=retorno/);
  await expect(client.getByText("Ativa (pagamento de teste)")).toBeVisible();
  const { data: openB } = await admin().from("commercial_subscriptions").select("id").eq("tenant_id", B).neq("status", "cancelada").single();
  const { count } = await admin().from("payment_invoices").select("provider_invoice_id", { count: "exact", head: true }).eq("subscription_id", openB!.id);
  expect(count ?? 0).toBe(0);
  const { data: ck } = await admin().from("payment_checkouts").select("kind, amount_cents, discount_bp").eq("tenant_id", B).order("created_at", { ascending: false }).limit(1).single();
  expect(ck).toMatchObject({ kind: "setup", amount_cents: 0, discount_bp: 0 });
});

test("Fase 10F: serviço cobrado fora da plataforma não pode ser contratado pela Stripe (cobrança em dobro)", async ({ browser }) => {
  const B = await tenantId("Empresa Ficticia B");
  // Estado limpo para B: sem assinatura aberta e sem origem ativa de execuções anteriores.
  await admin().from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "teste E2E 10F" }).eq("tenant_id", B).neq("status", "cancelada");
  await admin().from("billing_source_assignments").update({ status: "encerrada", ended_at: new Date().toISOString() }).eq("tenant_id", B).eq("status", "ativa");
  const sa = await login(browser, "SUPERADMIN");
  await sa.goto("/admin/pagamentos");
  const origens = sa.locator("section[aria-labelledby=origens]");
  await origens.locator("summary", { hasText: "Registrar cobrança feita fora da plataforma" }).click();
  await origens.getByLabel("Empresa").selectOption({ label: "Empresa Ficticia B" });
  await origens.getByLabel("Serviço").selectOption("nfse_plano");
  await origens.getByLabel("Cobrado por").selectOption("externo");
  await origens.getByRole("button", { name: "Registrar" }).click();
  await expect(sa.getByRole("status").filter({ hasText: "Origem de cobrança registrada." })).toBeVisible();
  // A mesma origem de novo: o banco recusa a segunda ativa.
  await origens.locator("summary", { hasText: "Registrar cobrança feita fora da plataforma" }).click();
  await origens.getByLabel("Empresa").selectOption({ label: "Empresa Ficticia B" });
  await origens.getByLabel("Serviço").selectOption("nfse_plano");
  await origens.getByRole("button", { name: "Registrar" }).click();
  await expect(origens.getByRole("alert").filter({ hasText: "Já existe uma origem de cobrança ativa" })).toBeVisible();

  // O cliente B tenta contratar pela plataforma: recusado com a explicação.
  const client = await login(browser, "CLIENTEB");
  await client.goto("/portal/plano");
  const card = client.getByRole("listitem").filter({ has: client.getByRole("heading", { name: "Nota Avulsa", exact: true }) });
  await card.locator("summary", { hasText: "Contratar (pagamento de teste)" }).click();
  for (const box of await card.getByRole("checkbox").all()) await box.check();
  await card.getByRole("button", { name: /Cadastrar forma de pagamento \(teste\)/ }).click();
  await expect(card.getByRole("alert").filter({ hasText: "já é cobrado por Outro meio" })).toBeVisible();
  const { count } = await admin().from("payment_checkouts").select("id", { count: "exact", head: true }).eq("tenant_id", B).eq("status", "aberto");
  expect(count ?? 0).toBe(0);

  // Encerrar a origem libera a contratação (só depois de parar a cobrança no outro meio).
  await sa.reload();
  const row = origens.getByRole("listitem").filter({ hasText: "Empresa Ficticia B · Plano de emissão de notas" });
  await row.locator("summary", { hasText: "Encerrar esta origem" }).click();
  await row.getByLabel("Digite ENCERRAR").fill("ENCERRAR");
  await row.getByRole("button", { name: "Encerrar" }).click();
  await sa.waitForURL(/origem=encerrada/);
  const { count: ativas } = await admin().from("billing_source_assignments").select("id", { count: "exact", head: true }).eq("tenant_id", B).eq("status", "ativa");
  expect(ativas ?? 0).toBe(0);
});

test("contador vê pagamentos só para leitura; super admin concilia sem erro", async ({ browser }) => {
  const c = await login(browser, "CONTADOR");
  await c.goto("/admin/pagamentos");
  await expect(c.getByRole("heading", { name: "Eventos do provedor" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Conciliar agora" })).toHaveCount(0);
  await expect(c.getByRole("button", { name: "Simular evento" })).toHaveCount(0);
  const sa = await login(browser, "SUPERADMIN");
  await sa.goto("/admin/pagamentos");
  await sa.getByRole("button", { name: "Conciliar agora" }).click();
  await expect(sa.getByText(/Conciliação: .* 0 erro\(s\)\./)).toBeVisible();
});
