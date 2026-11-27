import { expect, test } from "@playwright/test";

/**
 * Fase 10E: o formulário de contato aceitava clique ANTES da hidratação. Sem
 * o JavaScript pronto, o navegador fazia o envio nativo (GET para a mesma
 * página): a tela recarregava, a confirmação nunca aparecia e nome, e-mail e
 * telefone iam para a URL. Na CI, aparecia como instabilidade no WebKit, o
 * navegador mais lento. Estes testes REPRODUZEM a condição (sem retry).
 */
test("com o JavaScript desligado, o botão fica desativado e nada vai para a URL", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/contato");
  const button = page.getByRole("button", { name: "Enviar mensagem" });
  await expect(button).toBeDisabled();
  await expect(page.locator("form").filter({ has: button })).toHaveAttribute("method", "post");
  await context.close();
});

test("com a hidratação lenta, o clique cedo espera o formulário ficar pronto e envia sem dados na URL", async ({ page }) => {
  // Atraso artificial nos scripts do Next: a pessoa preenche antes da hidratação.
  await page.route("**/_next/static/chunks/**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  let posts = 0;
  await page.route("**/api/leads", (route) => {
    posts++;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, persisted: true }) });
  });
  await page.goto("/contato", { waitUntil: "commit" });
  await page.getByLabel("Nome completo").fill("Maria Teste");
  await page.getByLabel("E-mail").fill("maria@example.com");
  await page.getByLabel("WhatsApp", { exact: true }).fill("11999998888");
  // Antes da hidratação o botão não aceita clique.
  await expect(page.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();
  // Depois de hidratar, completa e envia (o clique espera o botão habilitar).
  await expect(page.getByRole("button", { name: "Enviar mensagem" })).toBeEnabled({ timeout: 30_000 });
  await page.getByLabel("Nome completo").fill("Maria Teste");
  await page.getByLabel("E-mail").fill("maria@example.com");
  await page.getByLabel("WhatsApp", { exact: true }).fill("11999998888");
  await page.getByLabel("Assunto").selectOption({ label: "Contabilidade" });
  await page.getByLabel("Descreva sua necessidade").fill("Quero saber mais sobre os serviços de contabilidade.");
  await page.getByLabel(/Concordo que a WJB/).check();
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByText("Mensagem enviada!")).toBeVisible({ timeout: 15_000 });
  expect(posts).toBe(1);
  expect(page.url()).not.toMatch(/name=|email=|phone=|maria/i);
});

test("clique duplo envia uma vez só", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/leads", async (route) => {
    posts++;
    await new Promise((r) => setTimeout(r, 800));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, persisted: true }) });
  });
  await page.goto("/contato", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Enviar mensagem" })).toBeEnabled();
  await page.getByLabel("Nome completo").fill("Maria Teste");
  await page.getByLabel("E-mail").fill("maria@example.com");
  await page.getByLabel("WhatsApp", { exact: true }).fill("11999998888");
  await page.getByLabel("Assunto").selectOption({ label: "Contabilidade" });
  await page.getByLabel("Descreva sua necessidade").fill("Quero saber mais sobre os serviços de contabilidade.");
  await page.getByLabel(/Concordo que a WJB/).check();
  const button = page.getByRole("button", { name: "Enviar mensagem" });
  await button.click();
  await button.click({ force: true }).catch(() => {});
  await expect(page.getByText("Mensagem enviada!")).toBeVisible({ timeout: 15_000 });
  expect(posts).toBe(1);
});
