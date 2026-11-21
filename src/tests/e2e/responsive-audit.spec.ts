import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Auditoria responsiva (Fase 8). Só roda com RESPONSIVE_AUDIT=1 contra o
 * build local de staging (homologação, usuários fictícios). Mede de verdade,
 * em Chromium com EMULAÇÃO de tamanho de tela (não é aparelho real):
 * - estouro horizontal da página e o elemento que causa;
 * - viewport sem bloqueio de zoom;
 * - alvos de toque menores que 24x24 CSS px (WCAG 2.2, 2.5.8);
 * - violações sérias/críticas do axe-core (amostra mobile e desktop), com
 *   prefers-reduced-motion para não medir contraste no meio de animação.
 * Grava a matriz em docs/wjb-ai/evidencias/responsivo.json.
 */
const enabled = process.env.RESPONSIVE_AUDIT === "1";
test.skip(!enabled, "Auditoria só com RESPONSIVE_AUDIT=1.");
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Auditoria roda no projeto chromium (emulação de tamanho).");
});
test.setTimeout(30 * 60_000);

const ALL = [
  [320, 568], [360, 800], [375, 667], [390, 844], [393, 852], [414, 896], [430, 932],
  [640, 400], [768, 1024], [820, 1180], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [844, 390],
] as const;
// 640x400 = tela de 1280x800 com zoom de 200%; 320x568 cobre o zoom de 400%.
const QUICK = [[320, 568], [390, 844], [768, 1024], [1280, 800]] as const;

const PUBLIC_CRITICAL = ["/", "/planos", "/emissao-de-notas", "/contato", "/servicos/abrir-empresa", "/blog/reforma-tributaria-como-preparar-empresa", "/login", "/area-do-cliente"];
const PUBLIC_REST = [
  "/sobre", "/como-funciona", "/servicos", "/solucoes", "/contabilidade-digital", "/armel-x-tecnologia", "/duvidas",
  "/blog", "/conteudos", "/solicitar-proposta", "/termos", "/cookies", "/politica-de-privacidade", "/ajuda",
  "/planos/mei", "/planos/simples-nacional", "/planos/lucro-presumido", "/servicos/trocar-de-contador",
  "/servicos/consultoria-contabil", "/recuperar-senha", "/pagina-que-nao-existe",
];
const PORTAL = ["/portal", "/portal/plano", "/portal/nfse", "/portal/nfse/nova", "/portal/nfse/assistente", "/portal/documentos", "/portal/obrigacoes", "/portal/notificacoes", "/portal/relatorios", "/portal/suporte"];
const ADMIN = ["/admin", "/admin/comercial", "/admin/whatsapp", "/admin/nfse", "/admin/nfse/perfis", "/admin/empresas", "/admin/leads", "/admin/logs"];

interface Row {
  area: string;
  route: string;
  viewport: string;
  status: number | null;
  overflowPx: number;
  culprits: string[];
  smallTargets: number;
  smallTargetSamples: string[];
  zoomBlocked: boolean;
}

async function measure(page: Page): Promise<Omit<Row, "area" | "route" | "viewport" | "status">> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflowPx = Math.max(0, document.documentElement.scrollWidth - vw);
    const culprits: string[] = [];
    if (overflowPx > 0) {
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1) continue;
        // Ignora o que está dentro de contêiner com rolagem horizontal própria.
        let p: HTMLElement | null = el.parentElement;
        let scoped = false;
        while (p && p !== document.body) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "auto" || ox === "scroll" || ox === "hidden") { scoped = true; break; }
          p = p.parentElement;
        }
        if (scoped) continue;
        const id = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${(el.className?.toString() ?? "").split(/\s+/).slice(0, 3).join(".")}`;
        culprits.push(`${id} (direita ${Math.round(r.right)}px)`);
        if (culprits.length >= 5) break;
      }
    }
    const small: string[] = [];
    let smallTargets = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]"))) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none") continue;
      // Exceção do critério 2.5.8: link dentro de texto corrido.
      if (el.tagName === "A" && cs.display === "inline" && el.parentElement && /^(P|LI|SPAN|DD|TD)$/.test(el.parentElement.tagName)) continue;
      if (r.width < 24 || r.height < 24) {
        smallTargets++;
        if (small.length < 4) small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    const meta = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
    const zoomBlocked = /user-scalable\s*=\s*(no|0)/i.test(meta) || /maximum-scale\s*=\s*1(\.0)?\b/i.test(meta);
    return { overflowPx, culprits, smallTargets, smallTargetSamples: small, zoomBlocked };
  });
}

async function login(browser: Browser, key: string) {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.addInitScript(() => window.localStorage.setItem("wjb-cookie-consent", "declined"));
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env[`HOMOLOG_USER_${key}`] ?? "");
  await page.getByLabel("Senha", { exact: true }).fill(process.env[`HOMOLOG_PW_${key}`] ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(portal|admin)/);
  return page;
}

/**
 * Tab pela página: o elemento focado precisa ter indicador visível (contorno
 * ou anel). Espera 150 ms após cada Tab (campos de data aplicam o estilo de
 * foco um instante depois). Voltar ao corpo da página só é falha se acontecer
 * antes de percorrer todos os elementos focáveis visíveis.
 */
async function focusAudit(page: Page, presses = 15) {
  const problems: string[] = [];
  const visible = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll<HTMLElement>("a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]:not([tabindex='-1'])")).filter(
        // Conteúdo de <details> fechado não recebe foco (o resumo, sim).
        (e) => e.offsetParent !== null && getComputedStyle(e).visibility !== "hidden" && !(e.closest("details:not([open])") && e.tagName !== "SUMMARY"),
      ).length,
  );
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return { ok: false, what: "BODY" };
      const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const ring = cs.boxShadow && cs.boxShadow !== "none";
      const rect = el.getBoundingClientRect();
      const what = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`;
      return { ok: outline || !!ring, what, offscreen: rect.bottom < 0 || rect.top > window.innerHeight + 2000 };
    });
    if (r.what === "BODY") {
      if (i < Math.min(visible, presses) - 1) problems.push(`voltou ao corpo da página após ${i} de ${visible} elementos visíveis`);
      break;
    }
    if (!r.ok) problems.push(r.what);
  }
  return [...new Set(problems)];
}

const AXE = readFileSync(path.join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");
async function axe(page: Page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    // @ts-expect-error axe injetado
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
    return (r.violations as { id: string; impact: string; nodes: unknown[] }[])
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`);
  });
}

const SHOT_ROUTES = ["/emissao-de-notas", "/planos", "/portal/plano", "/admin/comercial", "/admin/whatsapp", "/ajuda"];
const SHOTS = path.join(process.cwd(), "docs/wjb-ai/evidencias/f9");

test("matriz responsiva: público, Portal e Admin", async ({ browser }) => {
  const rows: Row[] = [];
  const axeRows: { area: string; route: string; viewport: string; violations: string[] }[] = [];
  const focusRows: { area: string; route: string; viewport: string; problems: string[] }[] = [];
  mkdirSync(SHOTS, { recursive: true });
  const run = async (page: Page, area: string, routes: string[], sizes: readonly (readonly [number, number])[], withAxe: boolean) => {
    for (const route of routes) {
      for (const [w, h] of sizes) {
        await page.setViewportSize({ width: w, height: h });
        const res = await page.goto(route, { waitUntil: "load" });
        await page.waitForTimeout(250);
        rows.push({ area, route, viewport: `${w}x${h}`, status: res?.status() ?? null, ...(await measure(page)) });
        if (SHOT_ROUTES.includes(route) && (w === 390 || w === 1280) && !area.includes("banner"))
          await page.screenshot({ path: path.join(SHOTS, `${route.replace(/\//g, "_").replace(/^_/, "") || "home"}-${w}.png`) });
      }
      if (withAxe) {
        for (const [w, h] of [[390, 844], [1280, 800]] as const) {
          await page.setViewportSize({ width: w, height: h });
          await page.goto(route, { waitUntil: "load" });
          axeRows.push({ area, route, viewport: `${w}x${h}`, violations: await axe(page) });
          await page.goto(route, { waitUntil: "load" });
          focusRows.push({ area, route, viewport: `${w}x${h}`, problems: await focusAudit(page) });
        }
      }
    }
  };
  const anon = await browser.newContext({ reducedMotion: "reduce" });
  await anon.addInitScript(() => window.localStorage.setItem("wjb-cookie-consent", "declined"));
  const pub = await anon.newPage();
  await run(pub, "público", PUBLIC_CRITICAL, ALL, true);
  await run(pub, "público", PUBLIC_REST, QUICK, true);
  // Primeira visita (banner de cookies visível) nas rotas críticas, no menor tamanho.
  const fresh = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await run(fresh, "público (banner de cookies)", PUBLIC_CRITICAL, [[320, 568]], false);
  await run(await login(browser, "CLIENTEA"), "portal", PORTAL, ALL, true);
  await run(await login(browser, "SUPERADMIN"), "admin", ADMIN, ALL, true);

  // Dani comercial no menor tamanho: o painel cabe na tela e o rodapé fica acessível.
  const dani: { viewport: string; top: number; bottom: number; fits: boolean }[] = [];
  for (const [w, h] of [[320, 568], [390, 844], [844, 390]] as const) {
    await pub.setViewportSize({ width: w, height: h });
    await pub.goto("/", { waitUntil: "networkidle" });
    await pub.getByRole("button", { name: "Abrir Assistente Virtual WJB" }).click();
    const dialog = pub.getByRole("dialog", { name: /Dani/ });
    await dialog.getByRole("button", { name: "Emitir notas fiscais (NFS-e)" }).click();
    await dialog.getByRole("button", { name: "Emitir notas de serviço (NFS-e)" }).click();
    await dialog.getByRole("button", { name: "Sou MEI" }).click();
    const box = (await dialog.boundingBox())!;
    dani.push({ viewport: `${w}x${h}`, top: Math.round(box.y), bottom: Math.round(box.y + box.height), fits: box.y >= 0 && box.y + box.height <= h + 1 });
    if (w === 390) await pub.screenshot({ path: path.join(SHOTS, "dani-comercial-390.png") });
    await pub.evaluate(() => window.sessionStorage.clear());
  }

  mkdirSync(path.join(process.cwd(), "docs/wjb-ai/evidencias"), { recursive: true });
  writeFileSync(path.join(process.cwd(), "docs/wjb-ai/evidencias/responsivo.json"), JSON.stringify({ geradoEm: new Date().toISOString(), ambiente: "build local de staging (homologação), Chromium com emulação", rows, axe: axeRows, foco: focusRows, dani }, null, 1));
  for (const f of focusRows.filter((x) => x.problems.length).slice(0, 40)) console.log(`FOCO ${f.area} ${f.route} ${f.viewport}: ${f.problems.join(" | ")}`);
  for (const d of dani) console.log(`DANI ${d.viewport}: topo ${d.top} base ${d.bottom} ${d.fits ? "cabe" : "NÃO CABE"}`);
  const bad = rows.filter((r) => r.overflowPx > 0 || r.zoomBlocked);
  console.log(`linhas: ${rows.length}; com estouro/zoom bloqueado: ${bad.length}; axe com violação: ${axeRows.filter((a) => a.violations.length).length}`);
  for (const b of bad.slice(0, 40)) console.log(`ESTOURO ${b.area} ${b.route} ${b.viewport}: ${b.overflowPx}px ${b.culprits.join(" | ")}`);
  for (const a of axeRows.filter((x) => x.violations.length).slice(0, 40)) console.log(`AXE ${a.area} ${a.route} ${a.viewport}: ${a.violations.join(", ")}`);
  const smallTop = rows.filter((r) => r.smallTargets > 0).sort((a, b) => b.smallTargets - a.smallTargets).slice(0, 15);
  for (const s of smallTop) console.log(`ALVO ${s.area} ${s.route} ${s.viewport}: ${s.smallTargets} (${s.smallTargetSamples.join("; ")})`);
  expect(rows.length).toBeGreaterThan(100);
});
