import { expect, test, type Page } from "@playwright/test";

/**
 * Varredura de TODOS os botões do Assistente Virtual (2026-09-23, pedido do
 * usuário depois de um bug real: o envio do formulário de qualificação
 * morria em "Não foi possível enviar agora" e a pessoa não chegava a lugar
 * nenhum). O `assistant.spec.ts` cobre os cenários do prompt mestre; este
 * aqui é a rede de segurança por controle - cada botão do widget é clicado
 * e tem o efeito verificado.
 *
 * Roda contra o build de produção sem Supabase configurado, que é
 * exatamente o estado em que o bug apareceu: `/api/leads` responde 503 e o
 * assistente precisa mesmo assim encaminhar pro WhatsApp.
 */

async function openAssistant(page: Page) {
  await page
    .getByRole("button", { name: "Abrir Assistente Virtual WJB" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Daniella, assistente virtual da WJB" }),
  ).toBeVisible();
}

test("launcher abre o painel", async ({ page }) => {
  await page.goto("/");
  await openAssistant(page);
});

test("minimizar fecha o painel e mantém o launcher clicável de novo", async ({
  page,
}) => {
  await page.goto("/");
  await openAssistant(page);

  await page.getByRole("button", { name: "Minimizar assistente" }).click();
  await expect(
    page.getByRole("dialog", { name: "Daniella, assistente virtual da WJB" }),
  ).toBeHidden();

  await openAssistant(page);
});

test("fechar volta pro launcher e reabre no menu inicial", async ({ page }) => {
  await page.goto("/");
  await openAssistant(page);

  // Entra numa tela interna antes de fechar, pra checar que o estado reseta.
  await page.getByRole("button", { name: "Abrir minha empresa" }).click();
  await expect(
    page.getByRole("button", { name: "Solicitar atendimento" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Fechar assistente" }).click();
  await expect(
    page.getByRole("dialog", { name: "Daniella, assistente virtual da WJB" }),
  ).toBeHidden();

  await openAssistant(page);
  await expect(
    page.getByRole("button", { name: "Abrir minha empresa" }),
  ).toBeVisible();
});

/**
 * Os 10 itens de conteúdo do menu (o 11º, "Falar com um especialista", abre
 * o WhatsApp e é testado à parte). Cada um tem que mostrar uma resposta com
 * os CTAs e levar pra uma rota real do site.
 */
const menuItems = [
  { label: "Abrir minha empresa", url: /\/servicos\/abrir-empresa$/ },
  { label: "Trocar de contador", url: /\/servicos\/trocar-de-contador$/ },
  {
    label: "Contabilidade para minha empresa",
    url: /\/servicos\/contabilidade-completa$/,
  },
  { label: "Contabilidade Digital", url: /\/contabilidade-digital$/ },
  { label: "MEI", url: /\/planos\/mei$/ },
  {
    label: "Departamento pessoal / Folha",
    url: /\/servicos\/departamento-pessoal$/,
  },
  { label: "Impostos e regularização", url: /\/servicos\/fiscal-tributario$/ },
  {
    label: "Consultoria contábil e tributária",
    url: /\/servicos\/consultoria-contabil$/,
  },
  { label: "Dúvidas frequentes", url: /\/duvidas$/ },
  { label: "Outros serviços", url: /\/servicos$/ },
];

for (const item of menuItems) {
  test(`menu "${item.label}": responde e "Conhecer o serviço" leva à rota real`, async ({
    page,
  }) => {
    await page.goto("/");
    await openAssistant(page);

    await page.getByRole("button", { name: item.label, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Conhecer o serviço" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Solicitar atendimento" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Conhecer o serviço" }).click();
    await expect(page).toHaveURL(item.url);
  });
}

test('menu "Falar com um especialista" abre o WhatsApp', async ({ page }) => {
  await page.goto("/");
  await openAssistant(page);

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Falar com um especialista" }).click(),
  ]);
  await expect(popup).toHaveURL(/whatsapp\.com/);
});

test('"Voltar ao menu" funciona na tela de serviço e na de qualificação', async ({
  page,
}) => {
  await page.goto("/");
  await openAssistant(page);

  await page.getByRole("button", { name: "MEI", exact: true }).click();
  await page.getByRole("button", { name: "Voltar ao menu" }).click();
  await expect(
    page.getByRole("button", { name: "Abrir minha empresa" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "MEI", exact: true }).click();
  await page.getByRole("button", { name: "Solicitar atendimento" }).click();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao menu" }).click();
  await expect(
    page.getByRole("button", { name: "Abrir minha empresa" }),
  ).toBeVisible();
});

test('rodapé "Falar direto com um especialista" aponta pro WhatsApp em todas as telas', async ({
  page,
}) => {
  await page.goto("/");
  await openAssistant(page);

  const escapeHatch = page.getByRole("link", {
    name: "Falar direto com um especialista",
  });
  await expect(escapeHatch).toBeVisible();
  await expect(escapeHatch).toHaveAttribute("href", /wa\.me/);

  // Continua acessível depois de entrar no fluxo (seção "ESCAPE HATCH").
  await page.getByRole("button", { name: "MEI", exact: true }).click();
  await expect(escapeHatch).toBeVisible();
  await page.getByRole("button", { name: "Solicitar atendimento" }).click();
  await expect(escapeHatch).toBeVisible();
});

test("formulário valida os campos obrigatórios antes de enviar", async ({
  page,
}) => {
  await page.goto("/");
  await openAssistant(page);

  await page.getByRole("button", { name: "MEI", exact: true }).click();
  await page.getByRole("button", { name: "Solicitar atendimento" }).click();
  await page.getByRole("button", { name: "Enviar e abrir WhatsApp" }).click();

  await expect(page.getByRole("alert").first()).toBeVisible();
});

/**
 * O bug do print: com `/api/leads` indisponível (503, sem Supabase), o
 * envio precisa mesmo assim abrir o WhatsApp com os dados e avançar pra
 * tela final - nunca parar num erro sem saída.
 */
test("envio abre o WhatsApp e conclui mesmo com /api/leads fora do ar", async ({
  page,
}) => {
  await page.route("**/api/leads", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "storage_unavailable" }),
    }),
  );

  await page.goto("/");
  await openAssistant(page);

  await page
    .getByRole("button", { name: "Contabilidade Digital", exact: true })
    .click();
  await page.getByRole("button", { name: "Solicitar atendimento" }).click();

  await page.getByLabel("Nome completo").fill("Maria Teste");
  await page.getByLabel("E-mail").fill("maria@teste.com");
  await page.getByLabel("WhatsApp", { exact: true }).fill("11987654321");
  await page.getByLabel(/Concordo/).check();

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Enviar e abrir WhatsApp" }).click(),
  ]);

  await expect(popup).toHaveURL(/whatsapp\.com/);
  const decoded = decodeURIComponent(popup.url()).replace(/\+/g, " ");
  expect(decoded).toContain("Serviço desejado: Contabilidade Digital");

  // Tela final + botão de fallback pro caso do pop-up ter sido bloqueado.
  await expect(page.getByText("Abrimos o WhatsApp com o resumo")).toBeVisible();
  const fallback = page.getByRole("link", { name: "Abrir o WhatsApp" });
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("href", /wa\.me/);
});

test("envio conclui normalmente quando /api/leads responde ok", async ({
  page,
}) => {
  await page.route("**/api/leads", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, persisted: true }),
    }),
  );

  await page.goto("/");
  await openAssistant(page);

  await page
    .getByRole("button", { name: "Trocar de contador", exact: true })
    .click();
  await page.getByRole("button", { name: "Solicitar atendimento" }).click();

  await page.getByLabel("Nome completo").fill("João Teste");
  await page.getByLabel("E-mail").fill("joao@teste.com");
  await page.getByLabel("WhatsApp", { exact: true }).fill("11912345678");
  await page.getByLabel(/Concordo/).check();

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Enviar e abrir WhatsApp" }).click(),
  ]);
  await expect(popup).toHaveURL(/whatsapp\.com/);
  await expect(page.getByText("Abrimos o WhatsApp com o resumo")).toBeVisible();
});

test('tela final: "Voltar ao menu" devolve pro menu inicial', async ({
  page,
}) => {
  await page.route("**/api/leads", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, persisted: true }),
    }),
  );

  await page.goto("/");
  await openAssistant(page);
  await page.getByRole("button", { name: "MEI", exact: true }).click();
  await page.getByRole("button", { name: "Solicitar atendimento" }).click();
  await page.getByLabel("Nome completo").fill("Ana Teste");
  await page.getByLabel("E-mail").fill("ana@teste.com");
  await page.getByLabel("WhatsApp", { exact: true }).fill("11911112222");
  await page.getByLabel(/Concordo/).check();

  await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Enviar e abrir WhatsApp" }).click(),
  ]);

  await page.getByRole("button", { name: "Voltar ao menu" }).click();
  await expect(
    page.getByRole("button", { name: "Abrir minha empresa" }),
  ).toBeVisible();
});
