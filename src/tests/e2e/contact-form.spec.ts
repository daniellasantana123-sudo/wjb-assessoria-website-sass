import { expect, test } from "@playwright/test";

test("mostra erros de validação ao enviar o formulário vazio", async ({ page }) => {
  await page.goto("/contato");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();

  await expect(page.getByText("Informe seu nome completo.")).toBeVisible();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
});

test("envia o formulário com dados válidos", async ({ page }) => {
  await page.goto("/contato");

  await page.getByLabel("Nome completo").fill("Maria Teste");
  await page.getByLabel("E-mail").fill("maria@example.com");
  await page.getByLabel("WhatsApp", { exact: true }).fill("11999998888");
  await page.getByLabel("Assunto").selectOption({ label: "Contabilidade" });
  await page
    .getByLabel("Descreva sua necessidade")
    .fill("Quero saber mais sobre os serviços de contabilidade.");
  await page.getByLabel(/Concordo que a WJB/).check();
  await page.getByRole("button", { name: "Enviar mensagem" }).click();

  await expect(page.getByText("Mensagem enviada!")).toBeVisible();
});
