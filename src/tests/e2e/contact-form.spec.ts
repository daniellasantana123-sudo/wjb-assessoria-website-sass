import { expect, test, type Page } from "@playwright/test";

test("mostra erros de validação ao enviar o formulário vazio", async ({
  page,
}) => {
  await page.goto("/contato");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();

  await expect(page.getByText("Informe seu nome completo.")).toBeVisible();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
});

async function fillValidForm(page: Page) {
  await page.getByLabel("Nome completo").fill("Maria Teste");
  await page.getByLabel("E-mail").fill("maria@example.com");
  await page.getByLabel("WhatsApp", { exact: true }).fill("11999998888");
  await page.getByLabel("Assunto").selectOption({ label: "Contabilidade" });
  await page
    .getByLabel("Descreva sua necessidade")
    .fill("Quero saber mais sobre os serviços de contabilidade.");
  await page.getByLabel(/Concordo que a WJB/).check();
}

/**
 * `route.fulfill` em vez de depender do backend real (2026-09-23): sem
 * credenciais de Supabase no ambiente, `/api/leads` responde 503 de
 * propósito e este teste falhava sempre por motivo de infraestrutura, não
 * de produto. Mockando a resposta, os dois caminhos ficam determinísticos
 * em qualquer máquina/CI.
 */
test("envia o formulário com dados válidos", async ({ page }) => {
  await page.route("**/api/leads", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, persisted: true }),
    }),
  );
  await page.goto("/contato");

  await fillValidForm(page);
  await page.getByRole("button", { name: "Enviar mensagem" }).click();

  await expect(page.getByText("Mensagem enviada!")).toBeVisible();
});

/**
 * Bug real de produção (2026-09-23): com o armazenamento indisponível o
 * formulário dizia só "tente novamente em instantes" - repetir não
 * resolvia nada e a pessoa ficava sem caminho. Agora tem que oferecer
 * WhatsApp e e-mail, que continuam funcionando.
 */
test("com o armazenamento fora do ar, oferece WhatsApp e e-mail", async ({
  page,
}) => {
  await page.route("**/api/leads", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "storage_unavailable" }),
    }),
  );
  await page.goto("/contato");

  await fillValidForm(page);
  await page.getByRole("button", { name: "Enviar mensagem" }).click();

  const alert = page
    .getByRole("status")
    .filter({ hasText: "Não foi possível enviar agora" });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    /wa\.me/,
  );
  await expect(alert.getByRole("link", { name: "e-mail" })).toHaveAttribute(
    "href",
    /^mailto:/,
  );
});
