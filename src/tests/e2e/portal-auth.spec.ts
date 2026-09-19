import { expect, test } from "@playwright/test";

/**
 * Login real da Plataforma SaaS (SAAS FASE 6, QA) — usa as contas de
 * teste permanentes (`E2E_TEST_EMAIL_CLIENT`/`_STAFF`/`_PASSWORD`, ver
 * `.env.example`), diferente das contas descartáveis criadas/apagadas ao
 * longo do desenvolvimento manual. Sem essas env vars (CI hoje não tem os
 * secrets do Supabase configurados) ou sem o projeto Supabase configurado
 * neste ambiente, os testes pulam sozinhos em vez de falhar — não é uma
 * lacuna de cobertura escondida, é uma dependência explícita documentada.
 */
const clientEmail = process.env.E2E_TEST_EMAIL_CLIENT;
const staffEmail = process.env.E2E_TEST_EMAIL_STAFF;
const password = process.env.E2E_TEST_PASSWORD;
const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const hasCredentials = Boolean(clientEmail && staffEmail && password && supabaseConfigured);

test.describe("Autenticação do Portal/Admin", () => {
  test.skip(!hasCredentials, "Faltam E2E_TEST_EMAIL_*/_PASSWORD ou Supabase não configurado.");

  test.beforeEach(async ({ page }) => {
    // Achado real rodando esta suíte pela primeira vez: o banner de
    // cookies (fixo no rodapé) intercepta cliques em botões perto do
    // fundo da tela (ex.: "Sair", no rodapé da sidebar do Portal) antes de
    // qualquer escolha — pré-configurar o consentimento evita o banner
    // aparecer, sem precisar clicar nele em cada teste.
    await page.addInitScript(() => {
      window.localStorage.setItem("wjb-cookie-consent", "declined");
    });
  });

  test("visitante deslogado tentando abrir /portal é redirecionado pro /login", async ({
    page,
  }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/login/);
  });

  test("cliente loga e cai no Portal, com a sidebar real", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(clientEmail!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL("/portal");
    await expect(page.getByRole("link", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Suporte" })).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("staff loga e cai no Admin, com os cards de navegação reais", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(staffEmail!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL("/admin");
    // Por href, não por nome do link — o nome acessível de cada card
    // inclui a descrição inteira, e mais de uma descrição menciona
    // "empresas" (ex.: "todas as empresas clientes"), o que fazia
    // `getByRole("link", { name: "Empresas" })` bater em 4 cards
    // diferentes (achado real rodando este teste pela primeira vez).
    await expect(page.locator('a[href="/admin/empresas"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/tickets"]')).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
