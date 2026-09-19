/**
 * Segunda leva de fotos reais fornecidas pelo usuário em 2026-08-30
 * (public/Imagen 01-29.png, sem 11-18, 1536x1024 cada) — cobre os 7
 * serviços que ainda estavam com placeholder e 12 dos 15 posts do blog.
 * Script de uso único, mesmo padrão de scripts/apply-real-photos.mjs.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "public", "images");

const mapping = [
  // Serviços (7 restantes)
  ["Imagen 07.png", "services/open-company.webp", 1600, 1067],
  ["Imagen 08.png", "services/change-accountant.webp", 1600, 1067],
  ["Imagen 25.png", "services/full-accounting.webp", 1600, 1067],
  ["Imagen 04.png", "services/payroll-hr.webp", 1600, 1067],
  ["Imagen 03.png", "services/tax-reform.webp", 1600, 1067],
  ["Imagen 21.png", "services/tax-recovery.webp", 1600, 1067],
  ["Imagen 28.png", "services/corporate-legalization.webp", 1600, 1067],
  // Blog (12 de 15)
  ["Imagen 29.png", "blog/accounting/business-deadlines-calendar.webp", 1600, 900],
  ["Imagen 19.png", "blog/accounting/digital-accounting-business.webp", 1600, 900],
  ["Imagen 20.png", "blog/technology/business-automation.webp", 1600, 900],
  ["Imagen 06.png", "blog/technology/business-data-dashboards.webp", 1600, 900],
  ["Imagen 01.png", "blog/tax/tax-planning-business.webp", 1600, 900],
  ["Imagen 02.png", "blog/tax/tax-review-compliance.webp", 1600, 900],
  ["Imagen 09.png", "blog/tax/lucro-presumido-business.webp", 1600, 900],
  ["Imagen 26.png", "blog/business/how-to-open-company.webp", 1600, 900],
  ["Imagen 24.png", "blog/business/change-accountant-checklist.webp", 1600, 900],
  ["Imagen 10.png", "blog/tax/fiscal-regularization.webp", 1600, 900],
  ["Imagen 22.png", "blog/accounting/balance-sheet-dre-decisions.webp", 1600, 900],
  ["Imagen 23.png", "blog/technology/ai-for-business.webp", 1600, 900],
];

// Sobraram sem slot claro (composição redundante com outras já usadas) —
// removidas junto com os originais convertidos, não ficam soltas em public/.
const unused = ["Imagen 05.png", "Imagen 27.png"];

for (const [src, dest, width, height] of mapping) {
  const srcPath = path.join(SRC_DIR, src);
  const destPath = path.join(OUT_DIR, dest);
  await sharp(srcPath)
    .resize(width, height, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(destPath);
  console.log(`OK ${src} -> ${dest} (${width}x${height})`);
}

for (const src of [...mapping.map((m) => m[0]), ...unused]) {
  await unlink(path.join(SRC_DIR, src));
}
console.log("\nFotos originais (Imagen NN.png) removidas após conversão.");
