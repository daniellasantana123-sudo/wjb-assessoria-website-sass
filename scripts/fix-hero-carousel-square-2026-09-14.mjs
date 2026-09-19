/**
 * Corrige a proporção do carrossel do Hero pra quadrada 1254x1254 (2026-
 * 09-14, mesmo dia — usuário mostrou o Canvas Size do Photoshop provando
 * que as fotos originais eram 1254x1254, e pediu pra carrossel refletir
 * essa medida exata, em vez do recorte 4:3 aplicado antes).
 *
 * IMPORTANTE: os PNGs quadrados originais foram apagados pelo script
 * anterior (`apply-hero-carousel-full-set-2026-09-14.mjs`, que limpou a
 * pasta de origem depois de converter — mesmo padrão usado em toda foto
 * do projeto). Este script reconstrói o quadrado a partir dos arquivos
 * já recortados em 1920x1440 (4:3), não do original intocado — não é
 * pixel-idêntico ao arquivo que o usuário tinha antes de anexar (aquele
 * recorte já removeu conteúdo do topo/base da imagem). `fit:"cover"` +
 * `sharp.strategy.attention` de novo, pra manter rosto/logo no quadro.
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "public", "images", "home");

for (let i = 1; i <= 9; i++) {
  const name = `home-hero-carousel-${String(i).padStart(2, "0")}.png`;
  const filePath = path.join(DIR, name);
  const buffer = await sharp(filePath).toBuffer();
  await sharp(buffer)
    .resize(1254, 1254, { fit: "cover", position: sharp.strategy.attention })
    .png()
    .toFile(filePath);
  console.log(`OK ${name} -> 1254x1254`);
}
