/**
 * Aplica as 7 fotos reais fornecidas pelo usuário em 2026-09-07 (01.png a
 * 07.png, largadas na raiz do repo, sem indicar destino) aos 7 slots de
 * `homeImages` (src/config/images.ts) - mapeamento por conteúdo/assunto de
 * cada foto, batendo com o `alt` já documentado em cada slot:
 *
 * - 01.png (equipe de 4, laptop, papéis com gráficos) -> businessNeeds
 * - 02.png (dupla, monitor com painel real "Visão Geral"/fiscal)
 *   -> digitalAccounting
 * - 03.png (dupla, laptop, overlay "REFORMA TRIBUTÁRIA" + gráfico)
 *   -> taxReform
 * - 04.png (equipe de 4, laptop, bandeira do Brasil ao fundo) -> wjbArmelx
 * - 05.png (aperto de mãos, logo WJB na parede) -> hero (indicado
 *   explicitamente pelo usuário)
 * - 06.png (dupla, monitor + laptop com gráficos) -> humanPlusTech
 * - 07.png (equipe de 4, laptop + telão com painel) -> finalCta
 *
 * Cada foto é redimensionada pro width/height exato já declarado no slot
 * (mantém o aspect-ratio/crop consistente com o que os componentes esperam)
 * e convertida pra webp, no mesmo caminho que já está em uso - sem mudança
 * de código necessária.
 */
import sharp from "sharp";

const jobs = [
  { src: "01.png", dest: "public/images/home/home-business-needs.webp", width: 1600, height: 1067 },
  { src: "02.png", dest: "public/images/home/home-digital-accounting-platform.webp", width: 1800, height: 1200 },
  { src: "03.png", dest: "public/images/home/home-tax-reform.webp", width: 1600, height: 1067 },
  { src: "04.png", dest: "public/images/home/home-wjb-armelx-business-technology.webp", width: 1800, height: 1200 },
  { src: "05.png", dest: "public/images/home/home-hero-wjb-consultive-accounting.webp", width: 1920, height: 1280 },
  { src: "06.png", dest: "public/images/home/home-human-plus-technology.webp", width: 1800, height: 1200 },
  { src: "07.png", dest: "public/images/home/home-final-consultation-cta.webp", width: 1600, height: 900 },
];

for (const job of jobs) {
  await sharp(job.src)
    .resize({ width: job.width, height: job.height, fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toFile(job.dest);
  console.log(`${job.src} -> ${job.dest}`);
}
