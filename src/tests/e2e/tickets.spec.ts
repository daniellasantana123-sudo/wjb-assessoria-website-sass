import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Fluxo completo de Tickets (SAAS FASE 3/4) — cliente abre um chamado,
 * staff responde e resolve, cliente confirma. Mesma dependência de
 * credenciais permanentes de `portal-auth.spec.ts` (ver ali o porquê do
 * skip condicional). Cobre em especial o caminho que teve um IDOR real
 * corrigido na revisão de segurança da FASE 6 (`replyTicket` —
 * `src/actions/tickets.ts`): este teste garante que o fluxo legítimo
 * continua funcionando depois daquele fix, não só que ele existe.
 *
 * Usa dois `browser.newContext()` (cliente e staff) em vez de duas abas da
 * mesma sessão — cada conta precisa da própria sessão autenticada, sem
 * compartilhar cookies.
 */
// Conta de cliente dedicada (não a mesma de portal-auth.spec.ts) — achado
// real: com `fullyParallel: true` (padrão do projeto), duas specs logando
// com a MESMA conta ao mesmo tempo colidiam (Supabase Auth rejeitava um
// dos dois logins concorrentes).
const clientEmail = process.env.E2E_TEST_EMAIL_CLIENT_TICKETS;
const staffEmail = process.env.E2E_TEST_EMAIL_STAFF;
const password = process.env.E2E_TEST_PASSWORD;
const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const hasCredentials = Boolean(clientEmail && staffEmail && password && supabaseConfigured);

test.skip(!hasCredentials, "Faltam E2E_TEST_EMAIL_*/_PASSWORD ou Supabase não configurado.");

/** Mesmo achado de `portal-auth.spec.ts` — evita o banner de cookies interceptar cliques. */
async function newPageWithoutCookieBanner(context: BrowserContext): Promise<Page> {
  await context.addInitScript(() => {
    window.localStorage.setItem("wjb-cookie-consent", "declined");
  });
  return context.newPage();
}

test("cliente abre chamado, staff responde e resolve, cliente confirma", async ({ browser }) => {
  const subject = `Teste E2E ${Date.now()}`;

  const clientContext = await browser.newContext();
  const clientPage = await newPageWithoutCookieBanner(clientContext);
  await clientPage.goto("/login");
  await clientPage.getByLabel("E-mail").fill(clientEmail!);
  await clientPage.getByLabel("Senha").fill(password!);
  await clientPage.getByRole("button", { name: "Entrar" }).click();
  await expect(clientPage).toHaveURL("/portal");

  await clientPage.goto("/portal/suporte");
  await clientPage.getByLabel("Assunto").fill(subject);
  await clientPage.getByLabel("Mensagem").fill("Mensagem de teste automatizado.");
  await clientPage.getByRole("button", { name: "Abrir chamado" }).click();
  await expect(clientPage).toHaveURL(/\/portal\/suporte\/[0-9a-f-]+/);
  await expect(clientPage.getByRole("heading", { name: subject })).toBeVisible();

  const staffContext = await browser.newContext();
  const staffPage = await newPageWithoutCookieBanner(staffContext);
  await staffPage.goto("/login");
  await staffPage.getByLabel("E-mail").fill(staffEmail!);
  await staffPage.getByLabel("Senha").fill(password!);
  await staffPage.getByRole("button", { name: "Entrar" }).click();
  await expect(staffPage).toHaveURL("/admin");

  await staffPage.goto("/admin/tickets");
  // O assunto inclui `Date.now()` — único o bastante pra não colidir com
  // nenhum outro chamado da lista, mesmo os de sessões de teste anteriores.
  await staffPage.getByRole("link", { name: subject }).click();
  await expect(staffPage.getByRole("heading", { name: subject })).toBeVisible();

  await staffPage.getByLabel("Escreva uma resposta...").fill("Resposta automatizada do staff.");
  await staffPage.getByRole("button", { name: "Responder" }).click();
  await expect(staffPage.getByText("Resposta automatizada do staff.")).toBeVisible();

  await staffPage.getByLabel("Status do chamado").selectOption("closed");
  // Por valor do <select>, não pelo texto "Resolvido" — o texto também
  // existe dentro de uma <option> não visível no DOM, o que arriscava um
  // "strict mode violation" (mesma classe de achado do seletor de
  // "Empresas" em portal-auth.spec.ts).
  await expect(staffPage.getByLabel("Status do chamado")).toHaveValue("closed");

  await clientPage.reload();
  await expect(clientPage.getByText("Resposta automatizada do staff.")).toBeVisible();
  await expect(clientPage.getByText("Este chamado foi marcado como resolvido.")).toBeVisible();

  await clientContext.close();
  await staffContext.close();
});
