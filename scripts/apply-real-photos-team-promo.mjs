/**
 * Quinta leva de fotos reais fornecidas pelo usuário em 2026-08-31 — 2
 * fotos direto em public/ ("são para você usar"), sem indicar destino.
 * Inspecionei o conteúdo: Imagen 01.png é um retrato solo (mulher, roupa
 * social, escritório com vidro ao fundo) -> retrato da equipe (Daniella
 * Santana, único slot de conteúdo do manifesto ainda sem foto real, ver
 * docs/design/images.md). Imagem 02.png é um consultor + cliente
 * revisando gráficos/documentos numa mesa -> combina exatamente com a
 * descrição já escrita para o slot novo services/services-menu-promo
 * (espaço vazio do mega menu "Serviços"), hoje só com placeholder.
 * Script de uso único, mesmo padrão de apply-real-photos-3.mjs.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "public", "images");

const mapping = [
  ["Imagen 01.png", "team/daniella-santana-portrait.webp", 1200, 1500],
  ["Imagem 02.png", "services/services-menu-promo.webp", 480, 600],
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
  console.log(`Removido ${src} de public/`);
}
