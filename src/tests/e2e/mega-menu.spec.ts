import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  // O mega menu só existe no nav desktop (xl, 1280px).
  testInfo.skip(testInfo.project.name === "mobile-chrome");
  await page.goto("/");
});

test("abre com clique, mostra as categorias e fecha com Escape", async ({ page }) => {
  const trigger = page
    .getByRole("navigation", { name: "Menu principal" })
    .getByRole("button", { name: "Serviços" });
  await trigger.click();

  const menu = page.locator("#mega-menu-servicos");
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByText("Contabilidade", { exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Ver todos os serviços →" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("fecha ao clicar fora", async ({ page }) => {
  const trigger = page
    .getByRole("navigation", { name: "Menu principal" })
    .getByRole("button", { name: "Serviços" });
  await trigger.click();
  await expect(page.locator("#mega-menu-servicos")).toBeVisible();

  await page.mouse.click(10, 10);
  await expect(page.locator("#mega-menu-servicos")).toBeHidden();
});
