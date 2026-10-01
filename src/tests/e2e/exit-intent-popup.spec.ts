import { expect, test } from "@playwright/test";

async function triggerExit(page: import("@playwright/test").Page, isMobile: boolean) {
  await page.clock.fastForward(30_000);
  await page.clock.resume();
  if (isMobile) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
  } else {
    await page.evaluate(() =>
      document.dispatchEvent(new MouseEvent("mouseout", { clientY: -5, relatedTarget: null, bubbles: true })),
    );
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("wjb-cookie-consent", JSON.stringify({ analytics: false, decidedAt: Date.now() }));
    } catch {}
  });
  await page.clock.install();
});

test("popup Antes de sair abre no gatilho, valida e envia o contato", async ({ page, isMobile }) => {
  await page.route("**/api/leads", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"persisted":true}' }),
  );
  await page.goto("/servicos", { waitUntil: "networkidle" });
  await triggerExit(page, isMobile);

  const dialog = page.getByRole("dialog", { name: /Precisa de um contador/ });
  await expect(dialog).toBeVisible();

  await page.getByRole("button", { name: "Quero falar com um contador" }).click();
  await expect(page.getByText("Informe seu nome.")).toBeVisible();

  await page.getByLabel("Nome").fill("Maria Teste");
  await page.getByLabel("WhatsApp", { exact: true }).fill("11976146375");
  await page.getByLabel("E-mail").fill("maria@empresa.com.br");
  await page.getByLabel("Assunto").selectOption("Abrir uma empresa");
  await page.getByLabel(/Concordo/).check();
  await page.getByRole("button", { name: "Quero falar com um contador" }).click();
  await expect(page.getByText("Recebemos seu contato!")).toBeVisible();
});

test("não abre em páginas que já têm formulário e não reabre depois de fechado", async ({ page, isMobile }) => {
  await page.goto("/contato", { waitUntil: "networkidle" });
  await triggerExit(page, isMobile);
  await expect(page.getByRole("dialog", { name: /Precisa de um contador/ })).toHaveCount(0);

  await page.goto("/sobre", { waitUntil: "networkidle" });
  await triggerExit(page, isMobile);
  await expect(page.getByRole("dialog", { name: /Precisa de um contador/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Precisa de um contador/ })).toHaveCount(0);

  await page.goto("/planos", { waitUntil: "networkidle" });
  await triggerExit(page, isMobile);
  await expect(page.getByRole("dialog", { name: /Precisa de um contador/ })).toHaveCount(0);
});
