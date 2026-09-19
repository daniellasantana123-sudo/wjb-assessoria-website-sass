/**
 * Atualiza a foto de capa de 8 posts do blog reaproveitando as fotos de
 * serviço renovadas hoje (2026-09-14) — mesmo padrão já usado no projeto
 * de reaproveitar foto real de página de serviço pro post do blog do
 * mesmo assunto (ver "Correção de imagens do blog" em
 * docs/design/images.md). Só os posts com correspondência de tema clara
 * e direta foram atualizados — os outros 7 posts (Simples Nacional,
 * Lucro Presumido, Contabilidade Digital, Gestão de Prazos, Automação,
 * Dashboards, IA) não têm equivalente entre as 10 fotos de hoje (que são
 * todas fiscal/societário/DP/contabilidade/consultoria) e ficaram como
 * estavam, pra não forçar uma combinação sem sentido.
 * `fit:"cover"` + `sharp.strategy.attention` recorta de 1600×1067 (3:2,
 * já o tamanho da foto de serviço) pra 1600×900 (16:9, padrão de capa do
 * blog). Script de uso único.
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVICES_DIR = path.join(ROOT, "public", "images", "services");
const BLOG_DIR = path.join(ROOT, "public", "images", "blog");
const OG_DIR = path.join(ROOT, "public", "images", "og");

const mapping = [
  ["tax-reform.webp", "reform/tax-reform-business-preparation.webp", "reforma-tributaria-como-preparar-empresa"],
  ["tax-planning.webp", "tax/tax-planning-business.webp", "planejamento-tributario-para-empresas"],
  ["tax-accounting.webp", "tax/tax-review-compliance.webp", "como-evitar-pagar-impostos-a-mais"],
  ["open-company.webp", "business/how-to-open-company.webp", "como-abrir-empresa"],
  ["change-accountant.webp", "business/change-accountant-checklist.webp", "como-trocar-de-contador"],
  ["compliance-regularization.webp", "tax/fiscal-regularization.webp", "regularizacao-fiscal-empresa"],
  ["full-accounting.webp", "accounting/balance-sheet-dre-decisions.webp", "balanco-dre-decisoes"],
  ["payroll-hr.webp", "payroll/payroll-organization.webp", "departamento-pessoal-folha"],
];

for (const [serviceFile, blogRelPath, slug] of mapping) {
  const srcPath = path.join(SERVICES_DIR, serviceFile);
  const blogPath = path.join(BLOG_DIR, blogRelPath);
  const ogPath = path.join(OG_DIR, `blog-${slug}.webp`);

  await sharp(srcPath)
    .resize(1600, 900, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(blogPath);

  await sharp(srcPath)
    .resize(1200, 630, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(ogPath);

  console.log(`OK ${serviceFile} -> blog/${blogRelPath} + og/blog-${slug}.webp`);
}
