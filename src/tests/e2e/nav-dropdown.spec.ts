import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  // Os submenus do header só existem no nav desktop (xl, 1280px).
  testInfo.skip(testInfo.project.name === "mobile-chrome");
  await page.goto("/");
});

test("submenu Soluções mostra os itens e o link 'ver todas'", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Menu principal" });
  await nav.getByRole("button", { name: "Soluções" }).click();

  const panel = page.locator("#nav-dropdown-soluções");
  await expect(panel.getByRole("link", { name: "Contabilidade Digital" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Armel-x Tecnologia" })).toBeVisible();

  await panel.getByRole("link", { name: "Ver todas as soluções →" }).click();
  await expect(page).toHaveURL("/solucoes");
});

test("submenu Empresa mostra os itens e navega para Sobre", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Menu principal" });
  await nav.getByRole("button", { name: "Empresa" }).click();

  const panel = page.locator("#nav-dropdown-empresa");
  await expect(panel.getByRole("link", { name: "Como funciona" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Dúvidas" })).toBeVisible();

  await panel.getByRole("link", { name: "Sobre" }).click();
  await expect(page).toHaveURL("/sobre");
});
