/**
 * Gera os ícones do site a partir de public/brand/logos/wjb-icon-badge.png.
 * Rodar de novo (`node scripts/gen-favicon.mjs`) se a marca for atualizada.
 *
 * 2026-09-07: usuário substituiu o arquivo por uma versão só com a marca
 * (azul+laranja) sobre fundo transparente, sem a "chapa" opaca que a versão
 * anterior tinha (2026-08-30, Flavicon_Wjb_Azul.png) — avisei que isso deixa
 * o favicon pouco visível em abas de navegador com fundo claro, e o usuário
 * optou por manter transparente mesmo assim. `apple-icon.png` continua
 * seguro (flatten com fundo branco abaixo, iOS pinta transparência de preto
 * sem isso); `icon.png`/`favicon.ico` ficam transparentes como o source.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "public", "brand", "logos", "wjb-icon-badge.png");

/** Empacota um PNG num contêiner .ico válido (1 imagem, formato PNG — suportado desde o Windows Vista). */
function pngToIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(1, 4); // number of images

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
  entry.writeUInt8(0, 2); // color palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // image data size
  entry.writeUInt32LE(header.length + entry.length, 12); // offset

  return Buffer.concat([header, entry, pngBuffer]);
}

await mkdir(path.dirname(SOURCE), { recursive: true });

// icon.png — Next.js App Router convention (<link rel="icon">, PNG moderno).
const icon512 = await sharp(SOURCE).resize(512, 512).png().toBuffer();
await writeFile(path.join(ROOT, "src", "app", "icon.png"), icon512);
console.log("OK src/app/icon.png (512×512)");

// apple-icon.png — convenção do Next.js para tela de início do iOS. `flatten`
// é só uma rede de segurança (o selo já é opaco) caso a fonte volte a ter
// transparência — o iOS pinta transparência de apple-touch-icon como preto.
const appleIcon180 = await sharp(SOURCE)
  .resize(180, 180)
  .flatten({ background: "#ffffff" })
  .png()
  .toBuffer();
await writeFile(path.join(ROOT, "src", "app", "apple-icon.png"), appleIcon180);
console.log("OK src/app/apple-icon.png (180×180)");

// favicon.ico — fallback legado (navegadores antigos, aba do navegador).
const favicon32 = await sharp(SOURCE).resize(32, 32).png().toBuffer();
await writeFile(path.join(ROOT, "src", "app", "favicon.ico"), pngToIco(favicon32, 32));
console.log("OK src/app/favicon.ico (32×32)");

console.log("\nÍcones gerados a partir de public/brand/logos/wjb-icon-badge.png.");
