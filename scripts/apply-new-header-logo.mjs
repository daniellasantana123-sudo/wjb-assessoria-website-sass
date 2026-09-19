/**
 * Substitui o logo azul do header pela arte de maior resolução fornecida
 * pelo usuário em 2026-09-05 (`Proposta logo wjb 2026/4x/logo wjb azul.png`,
 * mesmo traço "WJB assessoria contábil", export 4x/3368x1772, fundo
 * transparente) - mesmo caminho de destino já usado por `logo.tsx`, nenhuma
 * mudança de componente além do tamanho de exibição foi necessária.
 */
import sharp from "sharp";

const src =
  "/Users/armelsantana/Desktop/Clientes 2026/Wjb Assessoria Contábil/Proposta logo wjb 2026/4x/logo wjb azul.png";
const dest = "public/brand/logos/logo-wjb-color.png";

await sharp(src).resize({ width: 960 }).png({ compressionLevel: 9 }).toFile(dest);
console.log(`${src} -> ${dest}`);
