/**
 * Converte as 19 fotos reais fornecidas pelo usuário em 2026-08-30
 * (public/images/Imagen 01.png..19.png, 1536x1024 cada) para os slots do
 * manifesto WJB_Assets_Imagens_V1.md, substituindo os placeholders gerados
 * por scripts/gen-placeholders.mjs nos caminhos exatos já usados em
 * src/config/images.ts e src/config/service-pages.ts. Script de uso único
 * (não precisa rodar de novo, exceto para reprocessar as mesmas 19 fotos).
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "public", "images");
const OUT_DIR = path.join(ROOT, "public", "images");

const mapping = [
  ["Imagen 01.png", "home/home-hero-wjb-consultive-accounting.webp", 1920, 1280],
  ["Imagen 02.png", "armelx/wjb-armelx-hero.webp", 1920, 1280],
  ["Imagen 03.png", "services/accounting-consulting.webp", 1600, 1067],
  ["Imagen 04.png", "digital/digital-accounting-hero.webp", 1920, 1280],
  ["Imagen 05.png", "home/home-wjb-armelx-business-technology.webp", 1800, 1200],
  ["Imagen 06.png", "armelx/data-dashboards.webp", 1600, 1067],
  ["Imagen 07.png", "armelx/automation-integrations.webp", 1600, 1067],
  ["Imagen 08.png", "armelx/cloud-devops-software.webp", 1600, 1067],
  ["Imagen 09.png", "digital/digital-documents.webp", 1600, 1067],
  ["Imagen 10.png", "digital/digital-human-support.webp", 1600, 1067],
  ["Imagen 11.png", "services/compliance-regularization.webp", 1600, 1067],
  ["Imagen 12.png", "home/home-digital-accounting-platform.webp", 1800, 1200],
  ["Imagen 13.png", "digital/digital-calendar-obligations.webp", 1600, 1067],
  ["Imagen 14.png", "about/wjb-purpose-people.webp", 1800, 1200],
  ["Imagen 15.png", "services/tax-accounting.webp", 1600, 1067],
  ["Imagen 16.png", "home/home-tax-reform.webp", 1600, 1067],
  ["Imagen 17.png", "home/home-final-consultation-cta.webp", 1600, 900],
  ["Imagen 18.png", "services/tax-planning.webp", 1600, 1067],
  ["Imagen 19.png", "home/home-human-plus-technology.webp", 1800, 1200],
];

for (const [src, dest, width, height] of mapping) {
  const srcPath = path.join(SRC_DIR, src);
  const destPath = path.join(OUT_DIR, dest);
  await sharp(srcPath)
    .resize(width, height, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(destPath);
  console.log(`OK ${src} -> ${dest} (${width}x${height})`);
}

// Remove os originais soltos em public/images/ depois de convertidos.
for (const [src] of mapping) {
  await unlink(path.join(SRC_DIR, src));
}
console.log("\nFotos originais (Imagen NN.png) removidas após conversão.");
