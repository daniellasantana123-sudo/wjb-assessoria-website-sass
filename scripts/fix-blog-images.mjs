/**
 * Corrige dois problemas encontrados em 2026-08-30 depois das 4 levas de
 * fotos reais: (1) 3 posts do blog (Reforma Tributária, Simples Nacional,
 * Departamento Pessoal) nunca tinham recebido foto real — ficaram com o
 * placeholder gerado por engano; (2) os 3 posts de Tecnologia (Automação,
 * Dashboards, IA) usavam fotos quase idênticas entre si (mesma sessão de
 * fotos, mesma composição "reunião + tela de fundo").
 *
 * Reaproveita fotos reais já existentes no site (não há fotos novas
 * disponíveis) que são tematicamente coerentes com cada post — a mesma
 * foto usada na página de serviço/Armel-x correspondente. Script de uso
 * único: recorta cada fonte pra 1600x900 (16:9, padrão dos posts do blog).
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGES = path.join(ROOT, "public", "images");

const mapping = [
  ["services/tax-reform.webp", "blog/reform/tax-reform-business-preparation.webp"],
  ["services/tax-accounting.webp", "blog/tax/simples-nacional-business.webp"],
  ["services/payroll-hr.webp", "blog/payroll/payroll-organization.webp"],
  ["armelx/automation-integrations.webp", "blog/technology/business-automation.webp"],
  ["armelx/data-dashboards.webp", "blog/technology/business-data-dashboards.webp"],
  ["armelx/wjb-armelx-hero.webp", "blog/technology/ai-for-business.webp"],
];

for (const [src, dest] of mapping) {
  await sharp(path.join(IMAGES, src))
    .resize(1600, 900, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(path.join(IMAGES, dest));
  console.log(`OK ${src} -> ${dest}`);
}
