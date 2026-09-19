/**
 * Converte a foto fornecida pelo usuário em 2026-09-14 ("Recuperação
 * Tributária.png", largada na raiz do projeto, 1536x1024) para o slot da
 * página de serviço /servicos/recuperacao-tributaria
 * (src/config/service-pages.ts, "recuperacao-tributaria") e regenera a OG
 * image correspondente a partir da mesma foto. Script de uso único.
 *
 * Nota de conteúdo: a foto mostra um mockup de dashboard com valores em R$
 * ("Créditos identificados", "Em recuperação", "Recuperados") e "+38%
 * Potencial de economia" na tela, ao lado da logo da WJB na parede — dados
 * ilustrativos da própria imagem (não inseridos por código, não editáveis
 * via config), aplicados por instrução explícita do usuário após alerta
 * sobre o risco de parecerem resultado real de cliente.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "Recuperação Tributária.png");

const targets = [
  [path.join(ROOT, "public", "images", "services", "tax-recovery.webp"), 1600, 1067],
  [path.join(ROOT, "public", "images", "og", "servico-recuperacao-tributaria.webp"), 1200, 630],
];

for (const [destPath, width, height] of targets) {
  await sharp(SRC)
    .resize(width, height, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(destPath);
  console.log(`OK -> ${path.relative(ROOT, destPath)} (${width}x${height})`);
}

await unlink(SRC);
console.log("\nFoto original removida da raiz após conversão.");
