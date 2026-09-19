/**
 * Converte a foto fornecida pelo usuário em 2026-09-14 ("Atendimento WJB
 * 02.png", raiz do projeto, 1254x1254) para o novo slide do carrossel do
 * Hero da Home. Qualidade alta (95, não o padrão 82 do resto do site) —
 * pedido explícito do usuário ("qualidade automática/original") pra essa
 * imagem específica, que fica acima da dobra e é a mais visível do site.
 * `fit:"cover"` + `sharp.strategy.attention` recorta de 1:1 pra 4:3
 * (1920x1440), mesma proporção de exibição do slide existente
 * (`aspect-[4/3]` em hero.tsx, controlado via CSS + `object-cover`, não
 * pelas dimensões brutas do arquivo). Script de uso único.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "Atendimento WJB 02.png");
const DEST = path.join(ROOT, "public", "images", "home", "home-hero-atendimento.webp");

await sharp(SRC)
  .resize(1920, 1440, { fit: "cover", position: sharp.strategy.attention })
  .webp({ quality: 95 })
  .toFile(DEST);

console.log(`OK -> ${path.relative(ROOT, DEST)} (1920x1440, quality 95)`);

await unlink(SRC);
console.log("Foto original removida da raiz após conversão.");
