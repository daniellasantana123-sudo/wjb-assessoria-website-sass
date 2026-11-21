import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Fase 9 em STAGING (homologação Supabase real, usuários fictícios): preços
 * aprovados vindos do banco, landing, Click-to-Chat e Dani comercial.
 * Só via staging.sh.
 */
const enabled = process.env.HOMOLOG_STAGING === "1";
test.skip(!enabled, "Só no staging da homologação (staging.sh).");
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Staging roda só no projeto chromium.");
});

const ALLOWED_MESSAGES = new Set([
  "Olá! Tenho interesse no plano MEI Digital da WJB. Gostaria de receber orientações.",
  "Olá! Gostaria de contratar somente o serviço de emissão de NFS-e da WJB.",
  "Olá! Tenho interesse em Contabilidade Completa + Emissão de NFS-e.",
  "Olá! Gostaria de solicitar proposta para emissão de NFS-e em alto volume.",
  "Olá! Gostaria de falar com um contador da WJB Assessoria Contábil.",
  "Olá! Tenho uma dúvida sobre o serviço de emissão de NFS-e da WJB.",
]);
const nb = (s: string) => s.replace(/ /g, " ");

async function login(browser: Browser, key: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(() => window.localStorage.setItem("wjb-cookie-consent", "declined"));
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env[`HOMOLOG_USER_${key}`] ?? "");
  await page.getByLabel("Senha", { exact: true }).fill(process.env[`HOMOLOG_PW_${key}`] ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(portal|admin)/);
  return page;
}

async function checkWhatsAppLinks(page: Page) {
  // Fora o rodapé, que lista os números de contato da WJB sem mensagem (anterior à Fase 9).
  const hrefs = await page
    .locator('a[href*="wa.me"]')
    .evaluateAll((els) => els.filter((e) => !e.closest("footer")).map((e) => e.getAttribute("href") ?? ""));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const url = new URL(href);
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/5511976146375");
    const text = url.searchParams.get("text") ?? "";
    expect(href).not.toMatch(/ /); // mensagem sempre codificada
    expect(text).not.toMatch(/\d{11}|@|R\$/); // nada de CPF/CNPJ, e-mail ou valores
    expect(ALLOWED_MESSAGES.has(text) || /^Olá! Tenho interesse no plano .+ da WJB Assessoria Contábil\.$/.test(text), text).toBe(true);
  }
  return hrefs;
}

test("landing mostra os planos aprovados do banco, aviso do emissor gratuito e nenhum pagamento", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("wjb-cookie-consent", "declined"));
  await page.goto("/emissao-de-notas");
  const main = page.locator("main");
  const text = nb(await main.innerText());
  for (const v of ["R$ 24,90", "R$ 69,90", "R$ 149,90", "R$ 4,90 por nota autorizada", "Sob proposta", "R$ 19,92"]) expect(text).toContain(v);
  await expect(page.getByText("O emissor público de NFS-e é gratuito.")).toBeVisible();
  await expect(page.getByText(/A emissão pela WJB ainda não está disponível/)).toBeVisible();
  expect(text).not.toMatch(/emissão automática já disponível|pagar agora|assinar agora|checkout/i);
  await expect(main.getByRole("button", { name: /pagar|comprar|assinar (o )?plano|contratar agora|finalizar compra/i })).toHaveCount(0);
  await checkWhatsAppLinks(page);
  // "Tenho interesse" no MEI Digital já preenche o objetivo no pré-cadastro.
  await page.getByRole("link", { name: /Tenho interesse no plano MEI Digital/ }).click();
  await expect(page.getByLabel("O que você procura?")).toHaveValue("MEI Digital");
});

test("/planos leva à emissão com CTAs de WhatsApp corretos", async ({ page }) => {
  await page.goto("/planos");
  await expect(page.getByRole("link", { name: "Ver planos de emissão" })).toBeVisible();
  const hrefs = await checkWhatsAppLinks(page);
  const texts = hrefs.map((h) => new URL(h).searchParams.get("text"));
  expect(texts).toContain("Olá! Gostaria de contratar somente o serviço de emissão de NFS-e da WJB.");
  expect(texts).toContain("Olá! Tenho interesse em Contabilidade Completa + Emissão de NFS-e.");
});

test("catálogo público só expõe plano aprovado", async ({ request }) => {
  const admin = createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
  await admin.from("commercial_plans").insert({ sku: "nfse_teste_rascunho", product: "emissao", name: "Rascunho de teste", monthly_cents: 1, quota: 1, overage_cents: 1 });
  try {
    const res = await request.get("/api/commercial/catalog");
    const body = (await res.json()) as { plans: { sku: string }[]; comboDiscountBp: number };
    expect(body.plans.map((p) => p.sku).sort()).toEqual(["nfse_avulsa", "nfse_empresa", "nfse_mei", "nfse_profissional", "nfse_volume"]);
    expect(body.comboDiscountBp).toBe(2000);
    expect(JSON.stringify(body)).not.toMatch(/tenant|email|approval_reference|approved_by/);
  } finally {
    await admin.from("commercial_plans").delete().eq("sku", "nfse_teste_rascunho");
  }
});

async function openCommercial(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("wjb-cookie-consent", "declined"));
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Abrir Assistente Virtual WJB" }).click();
  const dialog = page.getByRole("dialog", { name: /Dani/ });
  await dialog.getByRole("button", { name: "Emitir notas fiscais (NFS-e)" }).click();
  return dialog;
}

test("Dani: MEI recebe o valor aprovado e o WhatsApp do MEI Digital", async ({ page }) => {
  const dialog = await openCommercial(page);
  await dialog.getByRole("button", { name: "Emitir notas de serviço (NFS-e)" }).click();
  await dialog.getByRole("button", { name: "Sou MEI" }).click();
  await expect(dialog).toContainText("R$ 24,90");
  await expect(dialog).toContainText("nenhuma nota é emitida e nada é cobrado");
  const wa = dialog.getByRole("link", { name: /MEI Digital no WhatsApp/ });
  expect(new URL((await wa.getAttribute("href")) ?? "").searchParams.get("text")).toBe(
    "Olá! Tenho interesse no plano MEI Digital da WJB. Gostaria de receber orientações.",
  );
  await expect(dialog.getByText(/Nada é enviado até você tocar em enviar/)).toBeVisible();
});

test("Dani: texto livre classifica o combo; 'emitir agora' explica a indisponibilidade", async ({ page }) => {
  const dialog = await openCommercial(page);
  await dialog.getByLabel("Ou escreva em poucas palavras").fill("quero contabilidade e emissão de notas");
  await dialog.getByRole("button", { name: "Enviar" }).click();
  await expect(dialog).toContainText("20% de desconto");
  await expect(dialog).toContainText(/não vale para os honorários/);
  await dialog.getByRole("button", { name: "Ver outras opções" }).click();
  await dialog.getByRole("button", { name: "Quero emitir uma nota agora" }).click();
  await expect(dialog).toContainText("Ainda não consigo emitir notas");
  await expect(dialog).not.toContainText(/nota (foi )?emitida/i);
  await dialog.getByRole("button", { name: "Entrar na lista de interesse" }).click();
  await page.waitForURL(/\/emissao-de-notas/);
});

test("Dani: contabilidade completa leva aos planos de contabilidade", async ({ page }) => {
  const dialog = await openCommercial(page);
  await dialog.getByRole("button", { name: "Contabilidade completa" }).click();
  await dialog.getByRole("button", { name: "Ver planos de contabilidade" }).click();
  await page.waitForURL(/\/planos$/);
});

test("Portal: Alto Volume não tem contratação, só proposta", async ({ browser }) => {
  // A fase 8 deixa um plano na empresa B: cancela (como o servidor faria) para ela ver o catálogo.
  const admin = createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
  const { data: b } = await admin.from("tenants").select("id").eq("name", "Empresa Ficticia B").single();
  await admin.from("commercial_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString(), cancel_reason: "teste E2E fase 9" }).eq("tenant_id", b!.id).neq("status", "cancelada");
  const page = await login(browser, "CLIENTEB");
  await page.goto("/portal/plano");
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Alto Volume", exact: true }) });
  await expect(card.getByText("Pedir proposta pelo WhatsApp")).toBeVisible();
  await expect(card.locator("summary", { hasText: "Contratar (simulação)" })).toHaveCount(0);
  await expect(page.getByText(/valor aprovado/).first()).toBeVisible();
});

test("Admin: planos aprovados com vigência e histórico; contador não aprova", async ({ browser }) => {
  const admin = await login(browser, "SUPERADMIN");
  await admin.goto("/admin/comercial");
  await expect(admin.getByText("aprovado", { exact: true })).toHaveCount(5);
  await expect(admin.getByText(/vigente desde 21\/11\/2026/).first()).toBeVisible();
  await admin.locator("summary", { hasText: "Histórico de versões" }).first().click();
  await expect(admin.getByText(/vigência 21\/11\/2026/).first()).toBeVisible();
  const contador = await login(browser, "CONTADOR");
  await contador.goto("/admin/comercial");
  await expect(contador.getByText(/Somente leitura/)).toBeVisible();
  await expect(contador.locator("summary", { hasText: "Editar" })).toHaveCount(0);
});
