/**
 * URL pública do site — ver .env.example. Sem `NEXT_PUBLIC_SITE_URL`
 * definida, cai no domínio real de produção (não mais `localhost:3000`
 * incondicionalmente) — a Hostinger não tinha essa env configurada no
 * build, o que fazia `metadataBase`/`og:image` apontarem pra
 * `localhost:3000` em produção (preview de link quebrado ao compartilhar
 * a URL real). `localhost` continua sendo o fallback só fora de produção
 * (dev local/build de CI sem a env).
 */
export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return process.env.NODE_ENV === "production"
    ? "https://wjbassessoriacontabil.com.br"
    : "http://localhost:3000";
}
