/**
 * Gera a imagem de pré-visualização (Open Graph) do guia do cliente, a capa
 * que aparece ao mandar wjbassessoriacontabil.com.br/ajuda no WhatsApp.
 * Desenha a capa em HTML com as fontes da WJB e fotografa em 1200x630.
 *
 *   node scripts/gen-manual-og.mjs
 *
 * Saída: public/manual/og-ajuda.jpg (JPEG, formato que o WhatsApp mostra
 * de forma confiável).
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";

const root = process.cwd();
const font = (f) => `data:font/woff2;base64,${readFileSync(path.join(root, "public/manual/fonts", f)).toString("base64")}`;
const logo = `data:image/webp;base64,${(await sharp("public/brand/logos/logo-wjb-white.png").trim().resize({ width: 520 }).webp({ quality: 92 }).toBuffer()).toString("base64")}`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Lexend; font-weight: 400 700; src: url(${font("lexend.woff2")}) format("woff2"); }
@font-face { font-family: "Source Sans 3"; font-weight: 400 700; src: url(${font("source-sans-3.woff2")}) format("woff2"); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #0e2447; color: #fff; font-family: "Source Sans 3", sans-serif; position: relative; overflow: hidden; }
.ring { position: absolute; right: -140px; top: -170px; width: 640px; height: 640px; border: 44px solid rgba(255,255,255,.06); border-radius: 50% 0 50% 50%; transform: rotate(18deg); }
.ring2 { position: absolute; right: 70px; bottom: -260px; width: 420px; height: 420px; border: 3px solid rgba(255,178,122,.35); border-radius: 50%; }
.wrap { position: absolute; inset: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
img { height: 92px; width: auto; align-self: flex-start; }
.eyebrow { font-family: Lexend; font-size: 22px; letter-spacing: .14em; text-transform: uppercase; color: #ffb27a; font-weight: 600; margin-bottom: 18px; }
h1 { font-family: Lexend; font-weight: 700; font-size: 84px; line-height: 1.02; letter-spacing: -0.015em; }
h1 em { font-style: normal; color: #ffb27a; }
p { font-size: 30px; color: rgba(255,255,255,.84); margin-top: 22px; max-width: 820px; line-height: 1.3; }
.url { font-family: Lexend; font-size: 22px; color: rgba(255,255,255,.72); display: flex; gap: 14px; align-items: center; }
.url b { width: 10px; height: 10px; border-radius: 50%; background: #ffb27a; display: inline-block; }
</style></head><body>
<div class="ring"></div><div class="ring2"></div>
<div class="wrap">
  <img src="${logo}" alt="">
  <div>
    <div class="eyebrow">Para clientes da WJB</div>
    <h1>Guia do <em>Portal</em><br>do Cliente</h1>
    <p>Prazos, documentos, guias e como falar com a nossa equipe.</p>
  </div>
  <div class="url"><b></b>wjbassessoriacontabil.com.br/ajuda</div>
</div>
</body></html>`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const tmp = path.join(os.tmpdir(), "wjb-og-ajuda.html");
writeFileSync(tmp, html);
await page.goto(`file://${tmp}`);
await page.evaluate(() => document.fonts.ready);
// A primeira captura de uma sessão do Chrome às vezes falha ("Unable to
// capture screenshot") sem relação com o conteúdo; a segunda funciona.
let png;
for (let attempt = 1; !png; attempt++) {
  try {
    png = await page.screenshot({ type: "png" });
  } catch (error) {
    if (attempt >= 3) throw error;
    await page.waitForTimeout(300);
  }
}
await browser.close();
rmSync(tmp);
await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile("public/manual/og-ajuda.jpg");
console.log("public/manual/og-ajuda.jpg gerada.");
