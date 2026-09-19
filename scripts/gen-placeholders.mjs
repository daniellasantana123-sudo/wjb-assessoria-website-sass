/**
 * Gera placeholders visuais (não fotografias) para os slots de imagem
 * definidos em WJB_Assets_Imagens_V1.md, nas dimensões exatas do manifesto.
 * Rodar de novo (`node scripts/gen-placeholders.mjs`) sempre que um novo
 * slot de imagem for adicionado antes da fotografia real chegar. Substituir
 * o arquivo gerado pela foto real assim que ela existir — nome e caminho
 * já ficam corretos, nenhuma mudança de código é necessária.
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

function svgPlaceholder(width, height, label) {
  const iconSize = Math.min(width, height) * 0.14;
  const cx = width / 2;
  const cy = height / 2 - iconSize * 0.3;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ececef"/>
  <rect x="${cx - iconSize}" y="${cy - iconSize * 0.7}" width="${iconSize * 2}" height="${iconSize * 1.4}" rx="${iconSize * 0.12}" fill="none" stroke="#98a0a9" stroke-width="${Math.max(2, iconSize * 0.05)}"/>
  <circle cx="${cx - iconSize * 0.55}" cy="${cy - iconSize * 0.28}" r="${iconSize * 0.16}" fill="#98a0a9"/>
  <path d="M ${cx - iconSize} ${cy + iconSize * 0.5} L ${cx - iconSize * 0.25} ${cy - iconSize * 0.05} L ${cx + iconSize * 0.2} ${cy + iconSize * 0.35} L ${cx + iconSize * 0.6} ${cy - iconSize * 0.15} L ${cx + iconSize} ${cy + iconSize * 0.5} Z" fill="#98a0a9" opacity="0.7"/>
  <text x="${cx}" y="${cy + iconSize * 1.35}" font-family="Arial, sans-serif" font-size="${Math.max(14, width * 0.014)}" fill="#5d656f" text-anchor="middle" font-weight="600">IMAGEM PENDENTE</text>
  <text x="${cx}" y="${cy + iconSize * 1.35 + Math.max(18, width * 0.018)}" font-family="Arial, sans-serif" font-size="${Math.max(11, width * 0.01)}" fill="#747f8b" text-anchor="middle">${label}</text>
</svg>`;
}

const images = [
  // HOME
  ["home/home-hero-wjb-consultive-accounting.webp", 1920, 1280],
  ["home/home-business-needs.webp", 1600, 1067],
  ["home/home-digital-accounting-platform.webp", 1800, 1200],
  ["home/home-human-plus-technology.webp", 1800, 1200],
  ["home/home-tax-reform.webp", 1600, 1067],
  ["home/home-wjb-armelx-business-technology.webp", 1800, 1200],
  ["home/home-final-consultation-cta.webp", 1600, 900],
  // SERVICES
  ["services/open-company.webp", 1600, 1067],
  ["services/change-accountant.webp", 1600, 1067],
  ["services/full-accounting.webp", 1600, 1067],
  ["services/tax-accounting.webp", 1600, 1067],
  ["services/payroll-hr.webp", 1600, 1067],
  ["services/corporate-legalization.webp", 1600, 1067],
  ["services/tax-planning.webp", 1600, 1067],
  ["services/tax-recovery.webp", 1600, 1067],
  ["services/compliance-regularization.webp", 1600, 1067],
  ["services/accounting-consulting.webp", 1600, 1067],
  ["services/tax-reform.webp", 1600, 1067],
  // DIGITAL
  ["digital/digital-accounting-hero.webp", 1920, 1280],
  ["digital/digital-documents.webp", 1600, 1067],
  ["digital/digital-calendar-obligations.webp", 1600, 1067],
  ["digital/digital-human-support.webp", 1600, 1067],
  // ARMELX
  ["armelx/wjb-armelx-hero.webp", 1920, 1280],
  ["armelx/automation-integrations.webp", 1600, 1067],
  ["armelx/data-dashboards.webp", 1600, 1067],
  ["armelx/cloud-devops-software.webp", 1600, 1067],
  // ABOUT
  ["about/wjb-purpose-people.webp", 1800, 1200],
  // BLOG (15 artigos — WJB_Blog_Conteudos_V1.md)
  ["blog/reform/tax-reform-business-preparation.webp", 1600, 900],
  ["blog/tax/tax-planning-business.webp", 1600, 900],
  ["blog/tax/tax-review-compliance.webp", 1600, 900],
  ["blog/tax/simples-nacional-business.webp", 1600, 900],
  ["blog/tax/lucro-presumido-business.webp", 1600, 900],
  ["blog/business/how-to-open-company.webp", 1600, 900],
  ["blog/business/change-accountant-checklist.webp", 1600, 900],
  ["blog/tax/fiscal-regularization.webp", 1600, 900],
  ["blog/accounting/balance-sheet-dre-decisions.webp", 1600, 900],
  ["blog/accounting/digital-accounting-business.webp", 1600, 900],
  ["blog/payroll/payroll-organization.webp", 1600, 900],
  ["blog/accounting/business-deadlines-calendar.webp", 1600, 900],
  ["blog/technology/business-automation.webp", 1600, 900],
  ["blog/technology/business-data-dashboards.webp", 1600, 900],
  ["blog/technology/ai-for-business.webp", 1600, 900],
  // OG
  ["og/home.webp", 1200, 630],
  ["og/contabilidade-digital.webp", 1200, 630],
  ["og/armelx.webp", 1200, 630],
  ["og/servico-abrir-empresa.webp", 1200, 630],
  ["og/servico-trocar-de-contador.webp", 1200, 630],
  ["og/servico-contabilidade-completa.webp", 1200, 630],
  ["og/servico-fiscal-tributario.webp", 1200, 630],
  ["og/servico-departamento-pessoal.webp", 1200, 630],
  ["og/servico-legalizacao-societario.webp", 1200, 630],
  ["og/servico-planejamento-tributario.webp", 1200, 630],
  ["og/servico-recuperacao-tributaria.webp", 1200, 630],
  ["og/servico-certidoes-regularizacao.webp", 1200, 630],
  ["og/servico-consultoria-contabil.webp", 1200, 630],
  ["og/servico-reforma-tributaria.webp", 1200, 630],
  ["og/blog-reforma-tributaria-como-preparar-empresa.webp", 1200, 630],
  ["og/blog-planejamento-tributario-para-empresas.webp", 1200, 630],
  ["og/blog-como-evitar-pagar-impostos-a-mais.webp", 1200, 630],
  ["og/blog-simples-nacional-guia-empresas.webp", 1200, 630],
  ["og/blog-lucro-presumido-como-funciona.webp", 1200, 630],
  ["og/blog-como-abrir-empresa.webp", 1200, 630],
  ["og/blog-como-trocar-de-contador.webp", 1200, 630],
  ["og/blog-regularizacao-fiscal-empresa.webp", 1200, 630],
  ["og/blog-balanco-dre-decisoes.webp", 1200, 630],
  ["og/blog-contabilidade-digital.webp", 1200, 630],
  ["og/blog-departamento-pessoal-folha.webp", 1200, 630],
  ["og/blog-gestao-prazos-obrigacoes.webp", 1200, 630],
  ["og/blog-automacao-processos-empresariais.webp", 1200, 630],
  ["og/blog-dashboards-dados-gestao.webp", 1200, 630],
  ["og/blog-inteligencia-artificial-negocios.webp", 1200, 630],
];

for (const [rel, width, height] of images) {
  const fullPath = path.join(ROOT, rel);
  await mkdir(path.dirname(fullPath), { recursive: true });
  const label = `${width}×${height} — ${path.basename(rel)}`;
  const svg = svgPlaceholder(width, height, label);
  await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(fullPath);
  console.log("OK", rel);
}
console.log(`\nTotal: ${images.length} placeholders gerados.`);
