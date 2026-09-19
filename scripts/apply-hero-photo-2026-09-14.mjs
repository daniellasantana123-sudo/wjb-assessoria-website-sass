/**
 * Substitui a foto do Hero da Home (2026-09-14, foto largada pelo usuário
 * na raiz do projeto como "Hero.png", 1536x1024) pelo slot
 * `homeImages.hero` (src/config/images.ts, 1920x1280). Mesmo padrão de
 * conversão usado em todas as fotos reais do site: sharp, fit:"cover" +
 * position:attention, qualidade 82 (padrão do projeto, sem tratamento
 * especial). Script de uso único.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "Hero.png");
const DEST = path.join(ROOT, "public", "images", "home", "home-hero-wjb-consultive-accounting.webp");

await sharp(SRC)
  .resize(1920, 1280, { fit: "cover", position: sharp.strategy.attention })
  .webp({ quality: 82 })
  .toFile(DEST);

console.log(`OK -> ${path.relative(ROOT, DEST)} (1920x1280, quality 82)`);

await unlink(SRC);
console.log("Foto original removida da raiz após conversão.");
