/**
 * Foto de OG da Home trocada em 2026-09-18. O usuário colocou um
 * "Atendimento.png" (1254x1254) direto na raiz do projeto pedindo pra
 * usar no lugar da OG image anterior (aperto de mão genérico, leva de
 * 2026-08-30) — mas o primeiro rodar deste script seguiu cegamente o
 * padrão de apply-real-photos-og.mjs (apagar a fonte após converter) e
 * apagou esse arquivo antes de eu perceber que o recorte automático
 * (`sharp.strategy.attention`) tinha cortado os dois rostos, focando só
 * na caneca/caderno. O arquivo não existia em nenhum outro lugar do
 * disco em resolução idêntica — perda real, sem como desfazer.
 *
 * Confirmado com o usuário (AskUserQuestion) qual substituto usar entre
 * variantes semelhantes já existentes em
 * `~/Desktop/Clientes 2026/Wjb Assessoria Contábil/`: escolheu
 * `Atendimento.png` (1729x910, já quase na proporção 1200x630 da OG —
 * corte mínimo). Fonte é um arquivo do cliente fora do repo,
 * propositalmente NÃO apagada desta vez.
 *
 * Lição: nunca apagar a fonte de um recorte de marketing antes de
 * conferir visualmente o resultado — o padrão dos scripts anteriores
 * (apagar logo após converter) só é seguro quando o recorte automático
 * já foi validado.
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath =
  "/Users/armelsantana/Desktop/Clientes 2026/Wjb Assessoria Contábil/Atendimento.png";
const destPath = path.join(ROOT, "public", "images", "og", "home.webp");

await sharp(srcPath)
  .resize(1200, 630, { fit: "cover", position: sharp.strategy.attention })
  .webp({ quality: 82 })
  .toFile(destPath);

console.log("OK Desktop/Atendimento.png -> images/og/home.webp (fonte preservada no Desktop)");
