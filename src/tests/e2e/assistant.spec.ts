import { expect, test } from "@playwright/test";

/**
 * Assistente Virtual WJB (prompt mestre do assistente, seção "TESTES
 * OBRIGATÓRIOS"). O balão de saudação demora ~5s pra aparecer - os testes
 * que não dependem dele não esperam por isso.
 */

test("avatar aparece sem interromper a navegação (Cenário 1)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Abrir Assistente Virtual WJB" })).toBeVisible();
  // A navegação normal do site continua funcionando com o bot ignorado.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("selecionar um serviço mostra conteúdo real + CTAs (Cenário 2)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Assistente Virtual WJB" }).click();
  await page.getByRole("button", { name: "Abrir minha empresa" }).click();

  await expect(page.getByRole("button", { name: "Conhecer o serviço" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar atendimento" })).toBeVisible();
});

test("selecionar o plano MEI navega para a rota real (Cenário 3)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Assistente Virtual WJB" }).click();
  await page.getByRole("button", { name: "MEI", exact: true }).click();
  await page.getByRole("button", { name: "Conhecer o serviço" }).click();

  await expect(page).toHaveURL(/\/planos\/mei$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("qualificação preenchida e enviada abre o WhatsApp com o resumo (Cenário 4)", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Assistente Virtual WJB" }).click();
  await page.getByRole("button", { name: "Trocar de contador", exact: true }).click();
  await page.getByRole("button", { name: "Solicitar atendimento" }).click();

  await page.getByLabel("Nome completo").fill("Maria Teste");
  await page.getByLabel("E-mail").fill("maria@teste.com");
  await page.getByLabel("WhatsApp", { exact: true }).fill("11987654321");
  await page.getByLabel(/Concordo/).check();

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Enviar e abrir WhatsApp" }).click(),
  ]);
  // wa.me redireciona pra api.whatsapp.com/send - checar o destino final e
  // que a mensagem contextual (serviço escolhido) foi passada corretamente.
  await expect(popup).toHaveURL(/whatsapp\.com/);
  const decodedPopupUrl = decodeURIComponent(popup.url()).replace(/\+/g, " ");
  expect(decodedPopupUrl).toContain("Serviço desejado: Trocar de Contador");
  await expect(page.getByText("Obrigado! Recebemos seus dados")).toBeVisible();
});

test("fechar o assistente não faz a saudação reaparecer na mesma sessão (Cenário 5)", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Assistente Virtual WJB" }).click();
  await page.getByRole("button", { name: "Fechar assistente" }).click();
  await expect(page.getByRole("button", { name: "Abrir Assistente Virtual WJB" })).toBeVisible();

  // Recarregar a mesma sessão não deve reabrir a saudação automaticamente.
  await page.reload();
  await page.waitForTimeout(6000);
  await expect(page.getByText("Falar com a Bia")).not.toBeVisible();
});

test("mobile: painel não cobre o CTA principal do herói (Cenário 7)", async ({
  page,
}, testInfo) => {
  testInfo.skip(testInfo.project.name !== "mobile-chrome");
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Assistente Virtual WJB" }).click();
  await expect(page.getByRole("dialog", { name: "Bia, assistente virtual da WJB" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Falar direto com um especialista" }),
  ).toBeVisible();
});

test("selecionar Contabilidade Digital mostra conteúdo real e navega (Cenário 8)", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Assistente Virtual WJB" }).click();
  await page.getByRole("button", { name: "Contabilidade Digital", exact: true }).click();
  await page.getByRole("button", { name: "Conhecer o serviço" }).click();

  await expect(page).toHaveURL(/\/contabilidade-digital$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("selecionar Dúvidas frequentes navega para a página real (Cenário 9)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Assistente Virtual WJB" }).click();
  await page.getByRole("button", { name: "Dúvidas frequentes", exact: true }).click();
  await page.getByRole("button", { name: "Conhecer o serviço" }).click();

  await expect(page).toHaveURL(/\/duvidas$/);
});

test("link direto /bia abre a Bia automaticamente (Cenário 10)", async ({ page }) => {
  await page.goto("/bia");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog", { name: "Bia, assistente virtual da WJB" })).toBeVisible();
  // A query string usada só pra sinalizar a abertura some da URL depois.
  await expect(page).not.toHaveURL(/assistente=aberto/);
});
