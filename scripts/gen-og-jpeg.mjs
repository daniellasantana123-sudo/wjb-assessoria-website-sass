/**
 * Imagens de compartilhamento (Open Graph) em JPEG (2026-10-14, auditoria).
 *
 * O WhatsApp nem sempre mostra WebP na pré-visualização de link - mesmo
 * motivo pelo qual os posts do blog já saem em JPEG (`blog/[slug]/opengraph-image.ts`).
 * Este script:
 *  1. converte as OG de páginas que ainda estavam em WebP (home, Armel-x,
 *     Contabilidade Digital e as 11 de serviço) para JPEG, no mesmo caminho
 *     com extensão .jpg, e apaga o WebP antigo;
 *  2. gera OG próprias para /sobre e /contato a partir da foto principal de
 *     cada página (antes as duas usavam a da Home).
 * As OG de blog (`blog-*.webp`) ficam como estão: são a matéria-prima que o
 * `opengraph-image.ts` converte para JPEG no build.
 *
 * Uso: node scripts/gen-og-jpeg.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OG_DIR = "public/images/og";
const SIZE = { width: 1200, height: 630 };
const jpeg = (img) => img.jpeg({ quality: 85, mozjpeg: true });

for (const file of fs.readdirSync(OG_DIR)) {
  if (!file.endsWith(".webp") || file.startsWith("blog-")) continue;
  const src = path.join(OG_DIR, file);
  const dest = src.replace(/\.webp$/, ".jpg");
  await jpeg(sharp(src).resize({ ...SIZE, fit: "cover" })).toFile(dest);
  fs.unlinkSync(src);
  console.log("convertida", dest);
}

const fromPhoto = [
  ["public/images/about/wjb-purpose-people.webp", "sobre.jpg"],
  ["public/images/contato/contact-hero.webp", "contato.jpg"],
];
for (const [photo, name] of fromPhoto) {
  const dest = path.join(OG_DIR, name);
  await jpeg(
    sharp(photo).resize({ ...SIZE, fit: "cover", position: sharp.strategy.attention }),
  ).toFile(dest);
  console.log("gerada", dest);
}
