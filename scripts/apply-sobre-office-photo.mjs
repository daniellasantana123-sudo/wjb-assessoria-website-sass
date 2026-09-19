/**
 * Oitava leva de fotos reais (2026-08-31) — usuário largou "Imagen 02.png"
 * direto em public/ (consultora e cliente revisando gráficos/relatórios
 * com notebook na mesa), pedindo pra trocar a foto da seção "Um escritório
 * preparado para atender empresas..." de /sobre. Essa seção usava
 * `homeImages.humanPlusTech`, que também aparece na Home (seção
 * HumanPlusTech) — criei um slot próprio em vez de sobrescrever o
 * compartilhado, mesmo padrão do `armelxImages.technologyTeam`.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public", "Imagen 02.png");
const DEST = path.join(ROOT, "public", "images", "about", "office-consulting.webp");

await sharp(SRC)
  .resize(1600, 1067, { fit: "cover", position: sharp.strategy.attention })
  .webp({ quality: 82 })
  .toFile(DEST);
console.log("OK Imagen 02.png -> images/about/office-consulting.webp (1600x1067)");

await unlink(SRC);
console.log("Removido Imagen 02.png de public/");
