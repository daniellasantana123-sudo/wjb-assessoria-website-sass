import { expect, test } from "@playwright/test";

/**
 * Fase 10G: o otimizador de imagens busca o arquivo no próprio servidor com
 * um pedido interno sem cabeçalho Host. Em 27/11, o bloqueio de endereço
 * respondeu 421 a esse pedido e todas as imagens otimizadas quebraram em
 * produção. Nenhum teste conferia isso.
 */
test("imagem otimizada do logo responde 200 (pedido interno do otimizador)", async ({ request }) => {
  const r = await request.get("/_next/image?url=%2Fbrand%2Flogos%2Flogo-wjb-color.png&w=128&q=90");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toMatch(/^image\//);
});

test("a Home carrega as imagens sem erro", async ({ page }) => {
  const failed: string[] = [];
  page.on("response", (res) => {
    if (res.url().includes("/_next/image") && res.status() >= 400) failed.push(`${res.status()}`);
  });
  await page.goto("/", { waitUntil: "networkidle" });
  expect(failed).toEqual([]);
});
