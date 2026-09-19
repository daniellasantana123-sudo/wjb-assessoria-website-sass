/**
 * Converte as 10 fotos fornecidas pelo usuário em 2026-09-14 na raiz do
 * projeto (já nomeadas pelo título exato da página de serviço, 1731x909
 * cada) para os slots de hero (services/*.webp, 1600x1067) das respectivas
 * páginas de serviço e regenera a OG image correspondente
 * (og/servico-<slug>.webp, 1200x630) a partir da mesma foto — mesmo padrão
 * já usado em `apply-tax-recovery-photo.mjs`. Cada slot de serviço é um
 * arquivo próprio (não compartilhado com as cópias reutilizadas no blog/Home
 * do mesmo assunto), então a troca fica isolada às páginas de serviço.
 * Script de uso único.
 */
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// [arquivo na raiz, slug de serviço, nome do arquivo em public/images/services/]
const mapping = [
  ["Abrir Empresa.png", "abrir-empresa", "open-company.webp"],
  ["Trocar de Contador.png", "trocar-de-contador", "change-accountant.webp"],
  ["Contabilidade Completa.png", "contabilidade-completa", "full-accounting.webp"],
  ["Fiscal e Tributário.png", "fiscal-tributario", "tax-accounting.webp"],
  ["Departamento Pessoal.png", "departamento-pessoal", "payroll-hr.webp"],
  ["Planejamento Tributário.png", "planejamento-tributario", "tax-planning.webp"],
  ["Reforma Tributária.png", "reforma-tributaria", "tax-reform.webp"],
  ["Certidões e Regularização.png", "certidoes-regularizacao", "compliance-regularization.webp"],
  ["Consultoria.png", "consultoria-contabil", "accounting-consulting.webp"],
  ["Legalização e Societário.png", "legalizacao-societario", "corporate-legalization.webp"],
];

for (const [srcFile, slug, destFile] of mapping) {
  const srcPath = path.join(ROOT, srcFile);
  const heroPath = path.join(ROOT, "public", "images", "services", destFile);
  const ogPath = path.join(ROOT, "public", "images", "og", `servico-${slug}.webp`);

  await sharp(srcPath)
    .resize(1600, 1067, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(heroPath);

  await sharp(srcPath)
    .resize(1200, 630, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(ogPath);

  console.log(`OK "${srcFile}" -> services/${destFile} + og/servico-${slug}.webp`);
}

for (const [srcFile] of mapping) {
  await unlink(path.join(ROOT, srcFile));
}
console.log("\n10 fotos originais removidas da raiz após conversão.");
