/**
 * Sexta leva de fotos reais fornecidas pelo usuário em 2026-08-31 — 8 fotos
 * de perfil geradas por IA, direto em public/ ("anexei as imagens na pasta
 * publica"), para os 8 depoimentos (WJB_Depoimentos_Carrossel_Fotos_Footer_
 * Claude_FINAL.md). O documento descreve a ordem de geração como "4
 * mulheres, depois 4 homens", mas ao inspecionar cada arquivo a ordem real
 * ficou intercalada: Imagen 01 (mulher), 02-05 (homens), 06-08 (mulheres).
 * Mapeamento por ordem de gênero dentro de cada grupo, na sequência exata
 * do documento (1ª mulher -> Mariana, 2ª -> Juliana, ...; 1º homem ->
 * Rafael, 2º -> Carlos, ...).
 */
import sharp from "sharp";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "public", "images", "testimonials");

await mkdir(OUT_DIR, { recursive: true });

const SIZE = 400;

const mapping = [
  ["Imagen 01.png", "mariana-costa.png"],
  ["Imagen 06.png", "juliana-rocha.png"],
  ["Imagen 07.png", "patricia-alves.png"],
  ["Imagen 08.png", "fernanda-ribeiro.png"],
  ["Imagen 02.png", "rafael-mendes.png"],
  ["Imagen 03.png", "carlos-henrique-lima.png"],
  ["Imagen 04.png", "andre-martins.png"],
  ["Imagen 05.png", "lucas-ferreira.png"],
];

for (const [src, dest] of mapping) {
  const srcPath = path.join(SRC_DIR, src);
  const destPath = path.join(OUT_DIR, dest);
  await sharp(srcPath)
    .resize(SIZE, SIZE, { fit: "cover", position: sharp.strategy.attention })
    .png({ quality: 85 })
    .toFile(destPath);
  console.log(`OK ${src} -> images/testimonials/${dest}`);
}

for (const [src] of mapping) {
  await unlink(path.join(SRC_DIR, src));
  console.log(`Removido ${src} de public/`);
}
