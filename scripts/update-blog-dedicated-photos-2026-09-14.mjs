/**
 * Troca a foto de capa dos 8 posts que antes reaproveitavam fotos de
 * página de serviço, por fotos dedicadas específicas do blog (2026-09-14,
 * mesmo dia) — usuário anexou 8 fotos genéricas (01.png..08.png, raiz do
 * projeto) com um print listando os 8 títulos de post na ordem
 * correspondente. Conferido visualmente que cada foto mostra literalmente
 * o assunto do post (documento/tela com o nome exato do tema escrito).
 * Mesmo padrão de sempre: `fit:"cover"` + `sharp.strategy.attention`,
 * 1600×900 pra capa do blog, 1200×630 pra OG, `quality: 82` ("qualidade
 * normal", pedido explícito - sem o tratamento especial de qualidade
 * original usado no carrossel do Hero). Script de uso único.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLOG_DIR = path.join(ROOT, "public", "images", "blog");
const OG_DIR = path.join(ROOT, "public", "images", "og");

const mapping = [
  ["01.png", "reform/tax-reform-business-preparation.webp", "reforma-tributaria-como-preparar-empresa"],
  ["02.png", "tax/tax-planning-business.webp", "planejamento-tributario-para-empresas"],
  ["03.png", "tax/tax-review-compliance.webp", "como-evitar-pagar-impostos-a-mais"],
  ["04.png", "business/how-to-open-company.webp", "como-abrir-empresa"],
  ["05.png", "business/change-accountant-checklist.webp", "como-trocar-de-contador"],
  ["06.png", "tax/fiscal-regularization.webp", "regularizacao-fiscal-empresa"],
  ["07.png", "accounting/balance-sheet-dre-decisions.webp", "balanco-dre-decisoes"],
  ["08.png", "payroll/payroll-organization.webp", "departamento-pessoal-folha"],
];

for (const [srcFile, blogRelPath, slug] of mapping) {
  const srcPath = path.join(ROOT, srcFile);
  const blogPath = path.join(BLOG_DIR, blogRelPath);
  const ogPath = path.join(OG_DIR, `blog-${slug}.webp`);

  await sharp(srcPath)
    .resize(1600, 900, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(blogPath);

  await sharp(srcPath)
    .resize(1200, 630, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(ogPath);

  console.log(`OK ${srcFile} -> blog/${blogRelPath} + og/blog-${slug}.webp`);
}

for (const [srcFile] of mapping) {
  await unlink(path.join(ROOT, srcFile));
}
console.log("\n8 fotos originais removidas da raiz após conversão.");
