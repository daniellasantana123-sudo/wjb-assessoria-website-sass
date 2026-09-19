/**
 * Substitui TODOS os slides do carrossel do Hero (2026-09-14, mesmo dia,
 * segunda leva) pelas 9 fotos fornecidas pelo usuário na pasta
 * "Carousel Website WJB" (raiz do projeto), na ordem pedida explicitamente:
 * Carousel 01 primeiro, Fiscal e Tributário segundo, resto em seguida
 * (ordem alfabética natural da pasta, já que o usuário não especificou uma
 * ordem exata pro restante).
 *
 * Diferente de toda foto anterior do site: aqui o pedido explícito foi
 * "formato original e qualidade original" — mantido `.png` (não `.webp`,
 * padrão usado em todo o resto do site) e codificação PNG sem perdas
 * (`sharp().png()` é lossless por natureza; nenhum parâmetro de qualidade
 * "lossy" é aplicado). Ainda assim recortado com `fit:"cover"` +
 * `sharp.strategy.attention` pra 1920x1440 (mesma proporção de exibição
 * 4:3 do slide anterior) — sem isso, o crop ficaria a cargo só do
 * `object-cover` do CSS (sem inteligência de conteúdo), com risco real de
 * cortar rosto/logo em fotos quadradas 1254x1254 como estas. O recorte em
 * si não introduz perda de qualidade (PNG é lossless independente do
 * tamanho); só reduz a área visível, não a fidelidade dos pixels mantidos.
 */
import sharp from "sharp";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "Carousel Website WJB");
const OUT_DIR = path.join(ROOT, "public", "images", "home");

// Ordem final pedida pelo usuário: 01, depois "Fiscal e Tributário", depois
// o resto (ordem alfabética da pasta).
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
  await sharp(path.join(SRC_DIR, filename))
    .resize(1920, 1440, { fit: "cover", position: sharp.strategy.attention })
    .png()
    .toFile(path.join(OUT_DIR, destName));
  console.log(`OK "${filename}" -> home/${destName}`);
  i++;
}

await rm(SRC_DIR, { recursive: true, force: true });
console.log("\nPasta 'Carousel Website WJB' removida da raiz após conversão.");
