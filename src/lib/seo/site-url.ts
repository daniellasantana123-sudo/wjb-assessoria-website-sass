/**
 * URL pública do site — ver .env.example.
 *
 * Lê em **tempo de execução** (2026-09-23, mesmo motivo de
 * `@/lib/db/supabase/env`): o Next substitui `process.env.NEXT_PUBLIC_*`
 * pelo valor durante o build, e a Hostinger injeta as variáveis do painel
 * só no processo em execução - então a referência literal resolvia
 * `undefined` em produção mesmo com a variável configurada. O acesso por
 * índice não é substituído no build.
 *
 * O fallback pro domínio real continua, porque em Client Component (onde
 * não existe `process.env`) e em página estática gerada no build isto
 * precisa devolver algo correto de qualquer forma.
 */
export function getSiteUrl() {
  const fromEnv =
    typeof process !== "undefined" && process.env
      ? process.env["SITE_URL"] || process.env["NEXT_PUBLIC_SITE_URL"]
      : undefined;
  if (fromEnv) return fromEnv;

  return process.env.NODE_ENV === "production"
    ? "https://wjbassessoriacontabil.com.br"
    : "http://localhost:3000";
}

/**
 * Destino dos links de convite e recuperação de senha enviados por e-mail
 * (Supabase Auth `redirectTo`).
 *
 * Existe como função própria por causa de um bug real (2026-09-23): os 5
 * pontos que montavam esse link usavam `process.env.NEXT_PUBLIC_SITE_URL`
 * direto, que nesta hospedagem é `undefined` no código compilado - todo
 * e-mail de convite e de "esqueci minha senha" saía com
 * `undefined/auth/callback`. Centralizar evita que o próximo lugar que
 * precise disso repita o erro.
 */
export function getAuthCallbackUrl() {
  return `${getSiteUrl()}/auth/callback`;
}
