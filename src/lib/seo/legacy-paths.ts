/**
 * Endereços do site antigo em WordPress que o Google ainda tenta visitar
 * (Search Console, 2026-10-12: `/wp-content/uploads/*`, `/wp-admin/*`,
 * `/wp-*.php`, `/comments/feed/`, `/mês`). Esse conteúdo não existe mais e
 * não tem equivalente no site novo, então respondemos 410 (Gone) em vez de
 * 404: para o Google, 410 diz "removido de propósito" e tira o endereço do
 * relatório mais depressa. Páginas antigas que TÊM equivalente (`/home`,
 * `/quem-somos`) são redirecionadas em `next.config.mjs`, não aqui.
 */
const LEGACY_PREFIXES = ["/wp-content", "/wp-admin", "/wp-includes", "/wp-json"];
const LEGACY_EXACT = new Set(["/xmlrpc.php", "/feed", "/comments/feed", "/mês"]);

export function isLegacyWordPressPath(rawPathname: string): boolean {
  let pathname = rawPathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    // Codificação inválida: segue com o texto cru.
  }
  pathname = pathname.toLowerCase().replace(/\/+$/, "") || "/";

  if (LEGACY_EXACT.has(pathname)) return true;
  if (/^\/wp-[^/]*\.php$/.test(pathname)) return true;
  if (pathname.endsWith("/feed")) return true;
  return LEGACY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
