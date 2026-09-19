/**
 * Terceira leva de fotos reais fornecidas pelo usuário em 2026-08-30 —
 * um conjunto de 7 fotos desenhado especificamente para os 7 slots de
 * imagem da Home (todas com espaço negativo à esquerda, compatível com o
 * layout de duas colunas texto+imagem já usado nas seções da Home).
 * Substitui as fotos da Home aplicadas nas levas anteriores e conecta
 * pela primeira vez home-business-needs (NeedsPicker), antes só placeholder.
 * Script de uso único, mesmo padrão de apply-real-photos.mjs.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "public", "images");

const mapping = [
  ["Imagen 01.png", "home/home-hero-wjb-consultive-accounting.webp", 1920, 1280],
  ["Imagen 04.png", "home/home-business-needs.webp", 1600, 1067],
  ["Imagen 02.png", "home/home-digital-accounting-platform.webp", 1800, 1200],
  ["Imagen 07.png", "home/home-human-plus-technology.webp", 1800, 1200],
  ["Imagen 06.png", "home/home-tax-reform.webp", 1600, 1067],
  ["Imagen 03.png", "home/home-wjb-armelx-business-technology.webp", 1800, 1200],
  ["Imagen 05.png", "home/home-final-consultation-cta.webp", 1600, 900],
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

for (const [src] of mapping) {
  await unlink(path.join(SRC_DIR, src));
}
console.log("\nFotos originais (Imagen NN.png) removidas após conversão.");
