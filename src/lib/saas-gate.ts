/**
 * A Plataforma SaaS (Portal/Admin/Login) está aberta ao público?
 *
 * Lido em **tempo de execução** (2026-09-23), pelo mesmo motivo de
 * `src/lib/db/supabase/env.ts`: o Next substitui toda referência literal a
 * `process.env.NEXT_PUBLIC_*` pelo valor durante o build, e a hospedagem
 * (Hostinger) injeta as variáveis do painel só no processo em execução.
 * Antes deste ajuste, ligar `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED=true` no
 * painel não teria efeito nenhum - o código compilado carregaria
 * `undefined` e o bloqueio continuaria de pé, sem nenhuma pista do motivo.
 *
 * O acesso por índice (`process.env[nome]`) não é substituído no build.
 * Aceita também o nome sem o prefixo `NEXT_PUBLIC_`, que é a forma
 * idiomática pra algo avaliado no servidor.
 *
 * **Limite conhecido**: em Client Components isto resolve `false`, porque
 * o navegador não tem `process.env`. Quem precisa do valor no cliente deve
 * recebê-lo por prop de um Server Component (ver `site-header.tsx` ->
 * `MobileNav`), nunca chamar esta função direto do lado do cliente.
 */
export function isSaasPublicEnabled(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  return (
    process.env["SAAS_PUBLIC_ENABLED"] === "true" ||
    process.env["NEXT_PUBLIC_SAAS_PUBLIC_ENABLED"] === "true"
  );
}
