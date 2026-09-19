/**
 * Sétima leva de fotos reais (2026-08-31) — usuário largou "Tecnologia_07.png"
 * direto em public/ (equipe de tecnologia analisando dashboards/arquitetura
 * de sistema/pipeline de deploy em telas), pedindo pra trocar a imagem da
 * seção "WJB + Armel-x Tecnologia" de /sobre. Como `armelxImages.automation`
 * (usada até agora nessa seção) também é usada em /armel-x-tecnologia, criei
 * um slot novo (`armelxImages.technologyTeam`) em vez de sobrescrever o
 * arquivo compartilhado — evita mudar a página da Armel-x sem pedido.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public", "Tecnologia_07.png");
const DEST = path.join(ROOT, "public", "images", "armelx", "technology-team.webp");

await sharp(SRC)
  .resize(1600, 1067, { fit: "cover", position: sharp.strategy.attention })
  .webp({ quality: 82 })
  .toFile(DEST);
console.log("OK Tecnologia_07.png -> images/armelx/technology-team.webp (1600x1067)");

await unlink(SRC);
console.log("Removido Tecnologia_07.png de public/");
