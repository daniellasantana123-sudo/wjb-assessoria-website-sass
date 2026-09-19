/**
 * Aplica a foto real fornecida pelo usuário como banner largo de /contato -
 * consultor e cliente conversando, com a marca WJB visível no vidro e na
 * caneca ao fundo. Redimensiona pra 1800px de largura (mesmo padrão de
 * outras fotos de página inteira do site, ex. aboutImage) e converte pra
 * webp.
 *
 * 2026-09-07: usuário trocou a fonte por "Atendimento.png" (raiz do repo),
 * mesma cena da versão anterior ("Imagem atendimento.png", 2026-09-06) mas
 * com o logo novo (traço arredondado + acento laranja) na parede de vidro e
 * na caneca, em vez do logo cursivo antigo - substitui o mesmo destino.
 */
import sharp from "sharp";

const src = "Atendimento.png";
const dest = "public/images/contato/contact-hero.webp";

await sharp(src).resize({ width: 1800 }).webp({ quality: 82 }).toFile(dest);
console.log(`${src} -> ${dest}`);
