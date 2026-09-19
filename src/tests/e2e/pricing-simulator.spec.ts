import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Fluxo completo do simulador de honorários (matriz oficial da WJB,
 * Tabela_de_Precos_WJB_Simulador_SP_2026_Preenchida.xlsx). Cobre o cenário
 * "MEI, sem funcionário" -> piso do plano (R$ 120), e a etapa que gera
 * proposta personalizada.
 */

/**
 * `SimulatorResult` é renderizado duas vezes no DOM ao mesmo tempo (cópia
 * mobile `.lg:hidden` e cópia desktop `.hidden.lg:block`), cada uma escondida
 * via CSS conforme o breakpoint - `.first()` pegaria sempre a cópia mobile
 * (ordem do DOM), não a visível. `.and(page.locator(':visible'))` resolve
 * sempre para a cópia que está de fato visível no viewport do projeto atual.
 */
function visibleText(page: Page, text: string) {
  return page.getByText(text).and(page.locator(":visible"));
}

/**
 * `<select>` controlado por React: se a interação acontecer antes da
 * hidratação terminar (comum em CI, onde o `webServer` roda `next dev` -
 * bundle não minificado, mais lento pra hidratar sob CPU mais fraca),
 * `selectOption` marca a opção no DOM nativo antes do handler `onChange`
 * existir; ao hidratar, o React reconcilia o `<select>` de volta pro seu
 * próprio estado (ainda vazio) e a seleção "desfaz". Reafirmar até o valor
 * realmente colar torna o teste resistente a essa corrida, sem depender de
 * um `waitForTimeout` arbitrário.
 */
async function selectStable(locator: Locator, value: string) {
  await expect(async () => {
    await locator.selectOption(value);
    expect(await locator.inputValue()).toBe(value);
  }).toPass({ timeout: 10_000 });
}
test("MEI sem funcionário calcula o piso do plano e abre o WhatsApp/lead form", async ({
  page,
}) => {
  await page.goto("/planos/simulador?regime=mei");

  await selectStable(page.getByLabel("Qual é o seu estado?"), "SP");
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(page.getByLabel("Qual é o tipo de atividade?"), "services");
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(
    page.getByLabel("Sua empresa possui Inscrição Estadual ativa?"),
    "no",
  );
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(page.getByLabel("Possui empregado?"), "0");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Situações especiais - não marca nenhuma.
  await page.getByRole("button", { name: "Continuar" }).click();

  // Adicionais - não marca nenhum.
  await page.getByRole("button", { name: "Ver resultado" }).click();

  await expect(page.getByText("Resumo da simulação")).toBeVisible();
  await expect(visibleText(page, "R$ 120,00 / mês")).toBeVisible();

  await page
    .getByRole("button", { name: "Quero falar com a WJB" })
    .and(page.locator(":visible"))
    .click();
  await expect(page.getByRole("heading", { name: "Contratar MEI" })).toBeVisible();
});

test("perfil com atividade especial resulta em proposta personalizada", async ({
  page,
}) => {
  await page.goto("/planos/simulador?regime=simples");

  await selectStable(page.getByLabel("Qual é o seu estado?"), "SP");
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(page.getByLabel("Qual é o tipo de atividade?"), "other");
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(
    page.getByLabel("Sua empresa possui Inscrição Estadual ativa?"),
    "no",
  );
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(page.getByLabel("Quantidade de sócios"), "1");
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(page.getByLabel("Quantidade de empregados"), "0");
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(page.getByLabel("Faturamento mensal"), "0-15000");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Ver resultado" }).click();

  await expect(
    visibleText(page, "Sua empresa precisa de uma análise personalizada"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Solicitar proposta personalizada" })
      .and(page.locator(":visible")),
  ).toBeVisible();
});

test("marcar uma situação especial força proposta personalizada mesmo com dados simples", async ({
  page,
}) => {
  await page.goto("/planos/simulador?regime=mei");

  await selectStable(page.getByLabel("Qual é o seu estado?"), "SP");
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(page.getByLabel("Qual é o tipo de atividade?"), "services");
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(
    page.getByLabel("Sua empresa possui Inscrição Estadual ativa?"),
    "no",
  );
  await page.getByRole("button", { name: "Continuar" }).click();

  await selectStable(page.getByLabel("Possui empregado?"), "0");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel("Contabilidade atrasada").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Ver resultado" }).click();

  await expect(
    visibleText(page, "Sua empresa precisa de uma análise personalizada"),
  ).toBeVisible();
});
