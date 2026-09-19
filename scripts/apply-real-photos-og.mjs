/**
 * Fotos feitas sob medida para Open Graph, fornecidas pelo usuário em
 * 2026-08-30 (public/Imagen 01-10.png, 1731x909 — praticamente a mesma
 * proporção de 1200x630 das OG images, ~1.9:1). Substituem as OG images
 * até então derivadas por recorte automático das fotos de conteúdo.
 * Script de uso único, mesmo padrão de apply-real-photos.mjs.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "public", "images", "og");

const mapping = [
  ["Imagen 01.png", "servico-planejamento-tributario.webp"],
  ["Imagen 02.png", "servico-departamento-pessoal.webp"],
  ["Imagen 03.png", "blog-dashboards-dados-gestao.webp"],
  ["Imagen 04.png", "servico-abrir-empresa.webp"],
  ["Imagen 05.png", "servico-trocar-de-contador.webp"],
  ["Imagen 06.png", "servico-consultoria-contabil.webp"],
  ["Imagen 07.png", "servico-contabilidade-completa.webp"],
  ["Imagen 08.png", "contabilidade-digital.webp"],
  ["Imagen 09.png", "blog-gestao-prazos-obrigacoes.webp"],
  ["Imagen 10.png", "armelx.webp"],
];

for (const [src, dest] of mapping) {
  const srcPath = path.join(SRC_DIR, src);
  const destPath = path.join(OUT_DIR, dest);
  await sharp(srcPath)
    .resize(1200, 630, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(destPath);
  console.log(`OK ${src} -> og/${dest}`);
}

for (const [src] of mapping) {
  await unlink(path.join(SRC_DIR, src));
}
console.log("\nFotos originais (Imagen NN.png) removidas após conversão.");
