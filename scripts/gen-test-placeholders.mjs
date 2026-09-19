/**
 * Gera um catálogo visual (public/Test/) de todas as fotos reais ainda
 * pendentes no site, cada uma com descrição/formato/destino escritos na
 * própria imagem — pedido do usuário em 2026-08-31, para revisar o que
 * falta sem precisar abrir código. `public/Test/` NÃO é referenciada por
 * nenhuma página do site (não é um slot real, é só um catálogo de revisão)
 * — pode ser apagada a qualquer momento sem quebrar nada.
 *
 * Rodar de novo (`node scripts/gen-test-placeholders.mjs`) sempre que a
 * lista de pendências mudar (ver docs/design/images.md, seção Pendências).
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "Test",
);

const CARD_WIDTH = 1000;
const CARD_HEIGHT = 750;

function wrapText(text, maxCharsPerLine) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function textBlock(label, value, x, yStart, lineHeight, maxChars, labelSize, valueSize) {
  const lines = wrapText(value, maxChars);
  const labelLine = `<text x="${x}" y="${yStart}" font-family="Arial, sans-serif" font-size="${labelSize}" font-weight="700" fill="#194382">${escapeXml(label)}</text>`;
  const valueLines = lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${yStart + labelSize + 8 + index * lineHeight}" font-family="Arial, sans-serif" font-size="${valueSize}" fill="#2b2f36">${escapeXml(line)}</text>`,
    )
    .join("\n");
  return {
    svg: `${labelLine}\n${valueLines}`,
    height: labelSize + 8 + lines.length * lineHeight,
  };
}

function card({ titulo, destino, descricao, formato, nota }) {
  const marginX = 48;
  let y = 70;

  const parts = [];

  parts.push(
    `<rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#f7f7f8"/>`,
  );
  parts.push(
    `<rect x="0" y="0" width="${CARD_WIDTH}" height="10" fill="#194382"/>`,
  );
  parts.push(
    `<text x="${marginX}" y="${y}" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#194382">FOTO PENDENTE</text>`,
  );
  parts.push(
    `<text x="${marginX}" y="${y + 32}" font-family="Arial, sans-serif" font-size="22" fill="#5d656f">${escapeXml(titulo)}</text>`,
  );
  y += 80;
  parts.push(
    `<line x1="${marginX}" y1="${y}" x2="${CARD_WIDTH - marginX}" y2="${y}" stroke="#d7d9dc" stroke-width="2"/>`,
  );
  y += 50;

  const destinoBlock = textBlock(
    "Onde vai (caminho do arquivo):",
    destino,
    marginX,
    y,
    26,
    62,
    18,
    18,
  );
  parts.push(destinoBlock.svg);
  y += destinoBlock.height + 34;

  const descBlock = textBlock(
    "Descrição da foto:",
    descricao,
    marginX,
    y,
    28,
    58,
    18,
    19,
  );
  parts.push(descBlock.svg);
  y += descBlock.height + 34;

  const formatoBlock = textBlock("Formato:", formato, marginX, y, 26, 62, 18, 18);
  parts.push(formatoBlock.svg);
  y += formatoBlock.height + 34;

  if (nota) {
    const notaBlock = textBlock("Observação:", nota, marginX, y, 24, 66, 16, 16);
    parts.push(
      `<g fill="#747f8b">${notaBlock.svg.replace(/fill="#194382"/g, 'fill="#747f8b"').replace(/fill="#2b2f36"/g, 'fill="#747f8b"')}</g>`,
    );
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
${parts.join("\n")}
</svg>`;
}

const placeholders = [
  {
    file: "team-membro-exemplo-portrait.png",
    titulo: "Equipe - Sobre (/sobre) - modelo para demais colaboradores",
    destino: "public/images/team/[nome]-[sobrenome]-portrait.webp",
    descricao:
      "Repetir este mesmo padrão para cada colaborador que a WJB queira exibir em /sobre - mesma proporção, fundo e enquadramento do retrato de Daniella Santana (já real, em public/images/team/daniella-santana-portrait.webp), para manter consistência visual entre os retratos.",
    formato: "Proporção retrato 4:5, mesmo estilo do arquivo de Daniella.",
    nota:
      "Quantidade de colaboradores a exibir ainda não foi definida - este é só o modelo de nomenclatura/formato.",
  },
];

await mkdir(OUT_DIR, { recursive: true });

for (const item of placeholders) {
  const svg = card(item);
  const fullPath = path.join(OUT_DIR, item.file);
  await sharp(Buffer.from(svg)).png().toFile(fullPath);
  console.log("OK", item.file);
}

console.log(`\nTotal: ${placeholders.length} placeholders gerados em public/Test/.`);
