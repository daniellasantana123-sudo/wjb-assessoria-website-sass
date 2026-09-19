/**
 * Atualiza a foto de capa dos 7 posts do blog que tinham ficado sem
 * correspondência na leva anterior (2026-09-14, mesmo dia) — usuário
 * anexou 7 fotos genéricas (01.png..07.png, raiz do projeto) e confirmou
 * "usar conforme anexados". Conferido visualmente que a ordem 01→07 bate
 * exatamente com a ordem dos 7 posts (cada foto mostra o assunto exato do
 * post - "Simples Nacional"/"Lucro Presumido" escritos no documento,
 * painel de Contabilidade Digital, checklist de prazos, workflow de
 * automação, dashboards financeiros, IA). Mesmo padrão de sempre:
 * `fit:"cover"` + `sharp.strategy.attention`, 1600×900 pra capa do blog,
 * 1200×630 pra OG, quality 82 (padrão do site - sem pedido de qualidade
 * original desta vez). Script de uso único.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLOG_DIR = path.join(ROOT, "public", "images", "blog");
const OG_DIR = path.join(ROOT, "public", "images", "og");

const mapping = [
  ["01.png", "tax/simples-nacional-business.webp", "simples-nacional-guia-empresas"],
  ["02.png", "tax/lucro-presumido-business.webp", "lucro-presumido-como-funciona"],
  ["03.png", "accounting/digital-accounting-business.webp", "contabilidade-digital"],
  ["04.png", "accounting/business-deadlines-calendar.webp", "gestao-prazos-obrigacoes"],
  ["05.png", "technology/business-automation.webp", "automacao-processos-empresariais"],
  ["06.png", "technology/business-data-dashboards.webp", "dashboards-dados-gestao"],
  ["07.png", "technology/ai-for-business.webp", "inteligencia-artificial-negocios"],
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
console.log("\n7 fotos originais removidas da raiz após conversão.");
