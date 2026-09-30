/**
 * Gera as versões do manual da Plataforma WJB a partir das fontes editáveis
 * em docs/manual/*.template.html. Rodar de novo depois de editar um template:
 *
 *   node scripts/build-manual.mjs
 *
 * Saídas:
 * - src/content/manual/manual-equipe.html  -> servido em /admin/manual (só equipe)
 * - src/content/manual/guia-cliente.html   -> servido em /ajuda (clientes)
 * - docs/manual/manual-plataforma-wjb.html e docs/manual/guia-portal-cliente.html
 *   -> versões autocontidas para abrir no navegador, imprimir em PDF ou
 *      publicar como Artifact (usam Google Fonts).
 *
 * As versões do site usam as fontes de /public/manual/fonts: a CSP do site
 * (next.config.mjs) bloqueia fontes de servidores externos.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const staffTemplate = readFileSync("docs/manual/manual.template.html", "utf8");
const clientTemplate = readFileSync("docs/manual/manual-cliente.template.html", "utf8");

async function logo(file, width) {
  const buffer = await sharp(`public/brand/logos/${file}`).trim().resize({ width }).webp({ quality: 90 }).toBuffer();
  return `data:image/webp;base64,${buffer.toString("base64")}`;
}
const LOGO_COLOR = await logo("logo-wjb-color.png", 520);
const LOGO_WHITE = await logo("logo-wjb-white.png", 520);

// Estilo e script vivem só no template da equipe; o do cliente reaproveita.
const styleStart = staffTemplate.indexOf('<link rel="preconnect"');
const styleEnd = staffTemplate.indexOf("</style>") + "</style>".length;
const STYLE = staffTemplate.slice(styleStart, styleEnd);
const SCRIPT = staffTemplate.slice(staffTemplate.lastIndexOf("<script>"));

const googleFonts = /<link rel="preconnect"[^>]*>\s*<link rel="preconnect"[^>]*>\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/;
const localFonts = `<style>
@font-face { font-family: "Lexend"; font-style: normal; font-weight: 400 700; font-display: swap; src: url("/manual/fonts/lexend.woff2") format("woff2"); }
@font-face { font-family: "Source Sans 3"; font-style: normal; font-weight: 400 700; font-display: swap; src: url("/manual/fonts/source-sans-3.woff2") format("woff2"); }
@font-face { font-family: "Source Sans 3"; font-style: italic; font-weight: 400; font-display: swap; src: url("/manual/fonts/source-sans-3-italic.woff2") format("woff2"); }
</style>`;

function fill(template, backLink) {
  const out = template
    .replace("{{STYLE}}", STYLE)
    .replace("{{SCRIPT}}", SCRIPT)
    .replaceAll("{{LOGO_COLOR}}", LOGO_COLOR)
    .replaceAll("{{LOGO_WHITE}}", LOGO_WHITE)
    .replace("{{BACK_LINK}}", backLink);
  if (out.includes("{{")) throw new Error("placeholder sem valor no manual");
  return out;
}

const SITE = "https://wjbassessoriacontabil.com.br";

/**
 * Tags de pré-visualização de link (WhatsApp, LinkedIn, e-mail). Só no guia
 * do cliente, que é o link mandado para fora; a imagem é gerada por
 * scripts/gen-manual-og.mjs. URLs absolutas: quem lê essas tags é o
 * servidor do WhatsApp, não o navegador.
 */
const clientShareTags = `<meta name="description" content="Como entrar, acompanhar prazos, enviar documentos e falar com a WJB pelo Portal do Cliente.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="WJB Assessoria Contábil">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="${SITE}/ajuda">
<meta property="og:title" content="Guia do Portal do Cliente | WJB Assessoria Contábil">
<meta property="og:description" content="Como entrar, acompanhar prazos, enviar documentos e falar com a WJB pelo Portal do Cliente.">
<meta property="og:image" content="${SITE}/manual/og-ajuda.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Capa do Guia do Portal do Cliente da WJB Assessoria Contábil">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/manual/og-ajuda.jpg">`;

/** Documento completo para servir pelo site (o Artifact monta o próprio esqueleto). */
function forSite(page, extraHead = "") {
  const local = page.replace(googleFonts, localFonts);
  const headEnd = local.indexOf("</style>", local.indexOf("<style>\n/* Layout")) + "</style>".length;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/icon.png">
${extraHead}
${local.slice(0, headEnd)}
</head>
<body>
${local.slice(headEnd)}
</body>
</html>
`;
}

mkdirSync("src/content/manual", { recursive: true });
writeFileSync("docs/manual/manual-plataforma-wjb.html", fill(staffTemplate, ""));
writeFileSync("docs/manual/guia-portal-cliente.html", fill(clientTemplate, "Guia do cliente"));
writeFileSync("src/content/manual/manual-equipe.html", forSite(fill(staffTemplate, '<a href="/admin">← Voltar ao Admin</a> · ')));
writeFileSync(
  "src/content/manual/guia-cliente.html",
  forSite(fill(clientTemplate, '<a href="/portal">Ir para o Portal →</a>'), clientShareTags),
);
console.log("Manual gerado.");
