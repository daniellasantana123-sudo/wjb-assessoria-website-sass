/**
 * Reconstrói o carrossel do Hero a partir dos PNGs ORIGINAIS de verdade
 * (2026-09-14, mesmo dia, usuário re-anexou a pasta "Carousel Website
 * WJB" depois que os arquivos da leva anterior tinham sido apagados por
 * engano). Diferente do script anterior, este NÃO redimensiona nem
 * recorta - copia os 1254x1254 originais bit-a-bit (`fs.copyFile`, não
 * `sharp`) pra garantir fidelidade 100% ao arquivo que o usuário anexou,
 * já que o pedido era justamente "formato original e qualidade
 * original" com a proporção quadrada nativa (1254x1254).
 *
 * Lição da leva anterior: a pasta de origem NÃO é apagada desta vez -
 * fica em "Carousel Website WJB/" como cópia de segurança, caso precise
 * reprocessar de novo.
 */
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "Carousel Website WJB");
const OUT_DIR = path.join(ROOT, "public", "images", "home");

const order = [
  "Carousel 01.png",
  "Fiscal e Tributário.png",
  "Abrir Empresa.png",
  "Carousel 05.png",
  "Carousel 06.png",
  "Carousel 07.png",
  "Carousel 08.png",
  "Planejamento Tributário.png",
  "Reforma Tributária.png",
];

let i = 1;
for (const filename of order) {
  const destName = `home-hero-carousel-${String(i).padStart(2, "0")}.png`;
  await copyFile(path.join(SRC_DIR, filename), path.join(OUT_DIR, destName));
  console.log(`OK "${filename}" -> home/${destName} (cópia bit-a-bit, sem reprocessamento)`);
  i++;
}

console.log("\nPasta 'Carousel Website WJB' mantida na raiz (não apagada desta vez).");
