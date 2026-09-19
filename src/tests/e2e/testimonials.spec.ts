import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("region", { name: "Depoimentos de clientes" }).scrollIntoViewIfNeeded();
});

/**
 * O selo "Depoimentos ilustrativos" foi removido da UI em 2026-09-14 (a
 * pedido explícito do usuário, reafirmado após alerta sobre o risco) - ver
 * src/content/testimonials/index.ts. Os depoimentos continuam fictícios
 * (`fictional: true` no dataset), só o aviso visível saiu do carrossel.
 */
test("mostra o primeiro depoimento ativo", async ({ page }) => {
  await expect(page.getByText("Mariana Costa")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ir para o depoimento de Mariana Costa" }),
  ).toHaveAttribute("aria-current", "true");
});

test("botão próximo avança o depoimento ativo", async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name === "mobile-chrome");
  await page.getByRole("button", { name: "Próximo depoimento" }).click();
  await expect(
    page.getByRole("button", { name: "Ir para o depoimento de Rafael Mendes" }),
  ).toHaveAttribute("aria-current", "true");
});

test("clicar num dot navega direto para aquele depoimento", async ({ page }) => {
  await page.getByRole("button", { name: "Ir para o depoimento de Lucas Ferreira" }).click();
  await expect(
    page.getByRole("button", { name: "Ir para o depoimento de Lucas Ferreira" }),
  ).toHaveAttribute("aria-current", "true");
});

test("seta do teclado avança o carrossel com foco no trilho", async ({ page }) => {
  await page.getByRole("list", { name: "Trilho de depoimentos" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Ir para o depoimento de Rafael Mendes" }),
  ).toHaveAttribute("aria-current", "true");
});
