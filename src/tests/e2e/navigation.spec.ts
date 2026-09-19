import { expect, test } from "@playwright/test";

test("home carrega com o hero e navega para Serviços pelo mega menu", async ({
  page,
}, testInfo) => {
  // O nav desktop só aparece em xl (1280px) — no projeto mobile-chrome fica
  // dentro do menu hambúrguer, já coberto pelo teste de menu mobile abaixo.
  testInfo.skip(testInfo.project.name === "mobile-chrome");

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Sua empresa cresce melhor",
  );

  await page
    .getByRole("navigation", { name: "Menu principal" })
    .getByRole("button", { name: "Serviços" })
    .click();
  await page.getByRole("link", { name: "Contabilidade Completa" }).click();
  await expect(page).toHaveURL("/servicos/contabilidade-completa");
});

test("footer tem os links institucionais e legais", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "Sobre" })).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "Política de Privacidade" }),
  ).toBeVisible();
});

test("menu mobile abre, foca no botão fechar e fecha com Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menuButton = page.getByRole("button", { name: "Abrir menu" });
  await menuButton.click();

  const dialog = page.getByRole("dialog", { name: "Menu principal" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar menu" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(menuButton).toBeFocused();
});
