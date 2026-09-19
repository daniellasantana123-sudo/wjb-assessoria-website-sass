/**
 * Substitui os logos da marca (header azul + footer branco) pelas duas
 * artes novas fornecidas pelo usuário direto na raiz do repo
 * (`logo wjb azul.png` / `logo wjb branco.png`, 2026-09-05) - mesmo traço
 * "WJB7 assessoria contábil" em versão vetorial mais nítida que as artes
 * anteriores. Redimensiona pra uma largura razoável pra web (960px,
 * mantendo proporção e fundo transparente) e sobrescreve os arquivos
 * existentes em `public/brand/logos/` - nenhuma mudança de componente
 * necessária (`logo.tsx`/`site-footer.tsx` já apontam pro mesmo caminho).
 */
import sharp from "sharp";

const jobs = [
  { src: "logo wjb azul.png", dest: "public/brand/logos/logo-wjb-color.png" },
  { src: "logo wjb branco.png", dest: "public/brand/logos/logo-wjb-white.png" },
];

for (const { src, dest } of jobs) {
  await sharp(src).resize({ width: 960 }).png({ compressionLevel: 9 }).toFile(dest);
  console.log(`${src} -> ${dest}`);
}
