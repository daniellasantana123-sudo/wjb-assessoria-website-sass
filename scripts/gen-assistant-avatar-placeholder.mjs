/**
 * Placeholder do avatar do Assistente Virtual WJB (prompt mestre do
 * assistente, 2026-09-05, ainda sem foto real fornecida pela WJB) - círculo
 * na cor primária da marca com as iniciais "WJB", mesmo espírito visual dos
 * outros placeholders do site ("FOTO PENDENTE"), só que dimensionado e
 * recortado pra um avatar circular pequeno em vez de um retrato de página.
 * Substituir por `sharp` (fit:"cover" + attention) quando a foto real
 * chegar - só troque o arquivo, nenhuma mudança de componente necessária.
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
  "wjb-assistant",
);

const size = 200;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <clipPath id="circle"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></clipPath>
  </defs>
  <g clip-path="url(#circle)">
    <rect width="100%" height="100%" fill="#2362a9"/>
    <text x="${size / 2}" y="${size / 2 + size * 0.09}" font-family="Arial, sans-serif" font-size="${size * 0.32}" fill="#ffffff" text-anchor="middle" font-weight="700">WJB</text>
  </g>
</svg>`;

const fullPath = path.join(ROOT, "avatar.webp");
await mkdir(path.dirname(fullPath), { recursive: true });
await sharp(Buffer.from(svg)).webp({ quality: 90 }).toFile(fullPath);
console.log("OK wjb-assistant/avatar.webp");
