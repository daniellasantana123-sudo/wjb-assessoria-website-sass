import { expect, test } from "@playwright/test";

test("página de serviço mostra breadcrumb, conteúdo e links relacionados", async ({
  page,
}) => {
  await page.goto("/servicos/fiscal-tributario");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fiscal e Tributário");
  await expect(page.getByRole("link", { name: "Planejamento Tributário" })).toBeVisible();
});

test("post de blog mostra o disclaimer e o CTA relacionado", async ({ page }) => {
  await page.goto("/blog/departamento-pessoal-folha");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Departamento Pessoal",
  );
  await expect(page.getByText("Conteúdo educativo e geral")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver Departamento Pessoal" }),
  ).toBeVisible();
});

test("slug de serviço inexistente mostra a página 404 customizada", async ({ page }) => {
  const response = await page.goto("/servicos/nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Página não encontrada")).toBeVisible();
});
