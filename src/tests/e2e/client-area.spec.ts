import { expect, test } from "@playwright/test";

test("Área do Cliente mostra o status real da Contabilidade Digital", async ({
  page,
}) => {
  await page.goto("/area-do-cliente");
  await expect(
    page.getByRole("heading", { level: 1, name: "Área do Cliente" }),
  ).toBeVisible();
  // Vários itens estão "Disponível" desde que a Plataforma SaaS entrou no ar
  // (2026-09-23) — `.first()` evita o strict mode do Playwright, que falha
  // quando o seletor casa com mais de um elemento.
  await expect(page.getByText("Disponível").first()).toBeVisible();
  // "Relatórios e indicadores" continua sem rota no Portal — a página tem que
  // seguir dizendo isso, senão vira promessa falsa.
  await expect(page.getByText("Planejado").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Solicitar meu acesso" }),
  ).toBeVisible();
});

test("Área do Cliente leva ao login quando a plataforma está aberta", async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_SAAS_PUBLIC_ENABLED !== "true",
    "área SaaS ainda fechada ao público (NEXT_PUBLIC_SAAS_PUBLIC_ENABLED != true)",
  );
  await page.goto("/area-do-cliente");
  await page.getByRole("link", { name: "Entrar na plataforma" }).click();
  await expect(page).toHaveURL("/login");
});

test("/login mostra o formulário real de acesso à Plataforma SaaS", async ({
  page,
}) => {
  // SAAS FASE 1 (2026-09-16): /login deixou de redirecionar pra
  // /area-do-cliente — agora é o formulário real (Supabase Auth). Sem
  // projeto Supabase configurado neste ambiente de teste, só valida que a
  // tela renderiza; o fluxo de autenticação de verdade depende de
  // NEXT_PUBLIC_SUPABASE_URL/ANON_KEY estarem configuradas.
  //
  // Pulado enquanto a área SaaS estiver fechada (2026-09-23): `src/proxy.ts`
  // devolve 404 de propósito em /login e nas demais rotas de plataforma até
  // `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED=true`, então este teste falhava por
  // decisão de produto, não por regressão — mesmo padrão de skip já usado em
  // `portal-auth.spec.ts`/`tickets.spec.ts`.
  test.skip(
    process.env.NEXT_PUBLIC_SAAS_PUBLIC_ENABLED !== "true",
    "área SaaS ainda fechada ao público (NEXT_PUBLIC_SAAS_PUBLIC_ENABLED != true)",
  );
  await page.goto("/login");
  await expect(page).toHaveURL("/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Entrar" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Esqueci minha senha" }),
  ).toBeVisible();
});
