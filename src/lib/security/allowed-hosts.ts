/**
 * Fase 10F (P0, segurança das prévias da Hostinger).
 *
 * Abrir um PR no GitHub faz a Hostinger publicar a branch num endereço
 * público `*.hostingersite.com` usando o MESMO `.env` da produção (banco,
 * e-mails, G-Click, segredo das rotinas). Prévia e produção têm exatamente
 * as mesmas variáveis, então nenhuma variável de ambiente distingue uma da
 * outra. O que distingue é o endereço pedido: o servidor só atende o domínio
 * oficial e o ambiente local; qualquer outro endereço recebe 421 antes de
 * tocar em sessão, banco ou integração.
 *
 * Falha de forma segura: sem cabeçalho Host, ou com um Host desconhecido, a
 * resposta é a recusa. Para liberar um endereço novo (ex.: um domínio de
 * homologação), sem novo deploy: `WJB_ALLOWED_HOSTS=host1,host2`, lida em
 * tempo de execução. Isso NUNCA deve incluir um endereço de prévia que use
 * o `.env` da produção.
 */

export const PRODUCTION_HOSTS = ["wjbassessoriacontabil.com.br", "www.wjbassessoriacontabil.com.br"] as const;

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"] as const;

/** Endereços que nunca podem ser liberados, mesmo por variável de ambiente. */
const NEVER_ALLOWED_SUFFIXES = [".hostingersite.com"] as const;

/** Host em minúsculas e sem porta; `null` quando ausente ou malformado. */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value || value.length > 255 || /[\s/\\@]/.test(value)) return null;
  // IPv6 entre colchetes, com ou sem porta: [::1]:3000
  const ipv6 = /^\[([0-9a-f:.]+)\](?::\d{1,5})?$/.exec(value);
  if (ipv6) return ipv6[1];
  const match = /^([a-z0-9.-]+)(?::\d{1,5})?$/.exec(value);
  if (!match) return null;
  return match[1].replace(/\.$/, "") || null;
}

function extraHosts(env: Record<string, string | undefined>): string[] {
  const raw = env["WJB_ALLOWED_HOSTS"];
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => normalizeHost(h))
    .filter((h): h is string => !!h && !NEVER_ALLOWED_SUFFIXES.some((s) => h.endsWith(s)));
}

export function isHostAllowed(
  rawHost: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const host = normalizeHost(rawHost);
  if (!host) return false;
  if (NEVER_ALLOWED_SUFFIXES.some((s) => host.endsWith(s))) return false;
  if ((PRODUCTION_HOSTS as readonly string[]).includes(host)) return true;
  if ((LOCAL_HOSTS as readonly string[]).includes(host)) return true;
  return extraHosts(env).includes(host);
}

/**
 * Arquivos estáticos de imagem e fonte (pasta `public/`). O otimizador de
 * imagens do Next busca o arquivo no próprio servidor com um pedido interno
 * SEM cabeçalho Host (achado em produção em 27/11: todas as imagens
 * otimizadas responderam 421). Esses arquivos não tocam sessão, banco nem
 * integração e não carregam segredo, então podem passar pelo bloqueio de
 * endereço; páginas, login, API e Server Actions continuam bloqueados.
 */
const STATIC_ASSET = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf)$/i;

export function isStaticAssetPath(pathname: string): boolean {
  return STATIC_ASSET.test(pathname) && !pathname.startsWith("/api/") && !pathname.includes("..");
}
