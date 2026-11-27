// Fase 10G: confere que o GTM/GA4 não recebe dado de formulário.
// Abre /contato com dados FICTÍCIOS na URL e na origem, com cookies aceitos,
// e registra os pedidos de coleta do Google SEM ENVIÁ-LOS (são abortados).
// Uso: node scripts/wjb-ai/producao/validar-gtm.mjs [url-base]
// Sai com código 1 se algum dado fictício aparecer em dl, dr ou no dataLayer.
import { chromium } from "playwright";

const base = process.argv[2] ?? "https://wjbassessoriacontabil.com.br";
const pii = "name=Maria+Ficticia&phone=11999998888";
const url = `${base}/contato?${pii}&utm_source=validacao`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
const ctx = await browser.newContext();
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("wjb-cookie-consent", "accepted");
  } catch {}
});
const page = await ctx.newPage();
const hits = [];
await page.route(/google-analytics\.com|analytics\.google\.com|\/g\/collect|doubleclick/, (r) => {
  hits.push(r.request().url());
  return r.abort();
});
const first = await page.goto(url, { referer: url, waitUntil: "networkidle" });
await page.waitForTimeout(8000);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);
const param = (u, k) => decodeURIComponent((u.split(/[?&]/).find((x) => x.startsWith(`${k}=`)) ?? "").slice(k.length + 1));
const collect = hits.filter((u) => u.includes("collect"));
const dataLayer = await page.evaluate(() => JSON.stringify(window.dataLayer ?? []));
const leak = (s) => /Maria|11999998888/.test(s);
const result = {
  primeiroStatus: first?.status() ?? null,
  urlFinal: page.url(),
  coletasBloqueadas: collect.length,
  dlComDados: collect.filter((u) => leak(param(u, "dl"))).length,
  drComDados: collect.filter((u) => leak(param(u, "dr"))).length,
  dataLayerComDados: leak(dataLayer),
};
console.log(JSON.stringify(result, null, 1));
await browser.close();
process.exit(result.dlComDados || result.drComDados || result.dataLayerComDados || leak(result.urlFinal) ? 1 : 0);
