/**
 * Corta o espaço transparente excedente e assimétrico ao redor da marca
 * (2026-09-14, usuário reportou o logo do footer "não alinhado à
 * esquerda") — os PNGs originais têm 505px de espaço vazio à esquerda
 * contra só 324px à direita (e 164px simétrico em cima/embaixo), então
 * nenhum CSS de alinhamento resolvia sozinho: o espaço extra é parte do
 * arquivo. `sharp().trim()` recorta exatamente no bounding box do
 * conteúdo visível (sem cor/alfa de fundo), deixando o arquivo simétrico
 * — o espaçamento visual passa a vir só do CSS/layout de quem usa o
 * logo, como já é o padrão de assets de marca bem empacotados.
 * Script de uso único.
 */
import sharp from "sharp";

const files = [
  "public/brand/logos/logo-wjb-color.png",
  "public/brand/logos/logo-wjb-white.png",
];

for (const file of files) {
  const { info } = await sharp(file).trim().png().toBuffer({ resolveWithObject: true });
  await sharp(file).trim().png().toFile(file + ".tmp");
  const fs = await import("node:fs/promises");
  await fs.rename(file + ".tmp", file);
  console.log(`OK ${file} -> ${info.width}x${info.height}`);
}
