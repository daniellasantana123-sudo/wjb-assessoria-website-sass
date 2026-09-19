/**
 * Gera o placeholder visual do novo slot `services/services-menu-promo.webp`
 * (espaço vazio do mega menu "Serviços", ver src/config/images.ts). Script
 * de uso único e isolado — não reaproveita `gen-placeholders.mjs` porque
 * aquele script sobrescreve TODOS os slots do manifesto original sem
 * checar se já têm foto real, o que apagaria fotos reais já aplicadas.
 * Substituir o arquivo gerado pela foto real quando ela existir — caminho
 * já fica correto, nenhuma mudança de código necessária.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "images",
);

const width = 480;
const height = 600;
const iconSize = Math.min(width, height) * 0.14;
const cx = width / 2;
const cy = height / 2 - iconSize * 0.3;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ececef"/>
  <rect x="${cx - iconSize}" y="${cy - iconSize * 0.7}" width="${iconSize * 2}" height="${iconSize * 1.4}" rx="${iconSize * 0.12}" fill="none" stroke="#98a0a9" stroke-width="${Math.max(2, iconSize * 0.05)}"/>
  <circle cx="${cx - iconSize * 0.55}" cy="${cy - iconSize * 0.28}" r="${iconSize * 0.16}" fill="#98a0a9"/>
  <path d="M ${cx - iconSize} ${cy + iconSize * 0.5} L ${cx - iconSize * 0.25} ${cy - iconSize * 0.05} L ${cx + iconSize * 0.2} ${cy + iconSize * 0.35} L ${cx + iconSize * 0.6} ${cy - iconSize * 0.15} L ${cx + iconSize} ${cy + iconSize * 0.5} Z" fill="#98a0a9" opacity="0.7"/>
  <text x="${cx}" y="${cy + iconSize * 1.35}" font-family="Arial, sans-serif" font-size="${Math.max(14, width * 0.03)}" fill="#5d656f" text-anchor="middle" font-weight="600">IMAGEM PENDENTE</text>
  <text x="${cx}" y="${cy + iconSize * 1.35 + Math.max(18, width * 0.038)}" font-family="Arial, sans-serif" font-size="${Math.max(11, width * 0.022)}" fill="#747f8b" text-anchor="middle">${width}×${height} — services-menu-promo.webp</text>
</svg>`;

const fullPath = path.join(ROOT, "services/services-menu-promo.webp");
await mkdir(path.dirname(fullPath), { recursive: true });
await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(fullPath);
console.log("OK services/services-menu-promo.webp");
