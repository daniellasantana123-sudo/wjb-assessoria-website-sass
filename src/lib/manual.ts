import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Páginas do manual da Plataforma WJB, geradas por `scripts/build-manual.mjs`
 * a partir de `docs/manual/*.template.html`. São documentos HTML completos
 * (visual próprio, sem o layout do site), servidos por route handler.
 */
const cache = new Map<string, string>();

export function readManual(file: "manual-equipe.html" | "guia-cliente.html"): string {
  const cached = cache.get(file);
  if (cached) return cached;
  const html = readFileSync(path.join(process.cwd(), "src", "content", "manual", file), "utf8");
  cache.set(file, html);
  return html;
}

export function manualResponse(html: string, cacheControl: string): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
