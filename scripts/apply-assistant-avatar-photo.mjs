/**
 * Foto real do avatar do Assistente Virtual WJB (2026-09-05).
 *
 * Duas levas no mesmo dia:
 * 1. `Assistente Virtual_Wjb.png` (corpo inteiro, cena de escritório com
 *    logo WJB ao fundo) - recorte manual (`extract` 700x700 a partir de
 *    left:30/top:20) pra isolar rosto+ombros antes de reduzir a 200x200.
 * 2. `Assistente Virtual - Wjb.png` (mesma pessoa, mas já em PNG com fundo
 *    transparente/recortado, sem cena de fundo) - fornecida pelo usuário
 *    depois de ainda ver o placeholder de texto "WJB" (na verdade cache do
 *    navegador da leva anterior, não um bug real) e pedir pra usar o rosto
 *    dessa foto. Por já vir cortada, um recorte simples (`extract` 650x650
 *    a partir de left:100/top:0) já rende um close-up de rosto bem
 *    enquadrado pra um avatar circular pequeno - esta é a versão final,
 *    ativa em `public/images/wjb-assistant/avatar.webp`.
 *
 * Ambos os arquivos-fonte ficam em
 * `~/Desktop/Clientes 2026/Wjb Assessoria Contábil/` (fora do repo,
 * mantidos intencionalmente intactos aí como cópia original).
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC =
  "/Users/armelsantana/Desktop/Clientes 2026/Wjb Assessoria Contábil/Assistente Virtual - Wjb.png";
const DEST = path.join(ROOT, "public", "images", "wjb-assistant", "avatar.webp");

await sharp(SRC)
  .extract({ left: 100, top: 0, width: 650, height: 650 })
  .resize(200, 200)
  .webp({ quality: 90 })
  .toFile(DEST);

console.log("OK", DEST);
