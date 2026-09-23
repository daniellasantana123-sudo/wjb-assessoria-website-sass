/**
 * Leitura das credenciais do Supabase **em tempo de execução** (2026-09-23).
 *
 * Por que não ler `process.env.NEXT_PUBLIC_SUPABASE_URL` direto: o Next
 * substitui toda referência literal a `process.env.NEXT_PUBLIC_*` pelo
 * valor **durante o build**. A Hostinger injeta as variáveis do painel
 * apenas no processo do app em execução, não no passo de build - então
 * essas referências viravam `undefined` no código compilado, mesmo com as
 * variáveis corretamente configuradas no painel. Foi exatamente isso que
 * derrubou a gravação de leads em produção (`/api/leads` respondendo 503
 * com `storage_unavailable` depois de configurar tudo), e o mesmo efeito
 * já tinha aparecido antes em `src/lib/seo/site-url.ts` ("a Hostinger não
 * tinha essa env configurada no build").
 *
 * O acesso por índice (`process.env[nome]`) não é substituído no build, e
 * no servidor `process.env` é o ambiente real do processo - então o valor
 * vem do painel normalmente. Aceita também os nomes sem o prefixo
 * `NEXT_PUBLIC_`, que são a forma idiomática pra algo lido só no servidor.
 *
 * Isto vale só pro lado servidor. O client de navegador
 * (`src/lib/db/supabase/client.ts`, usado por /login e /portal) continua
 * dependendo do valor embutido no build - quando a Plataforma SaaS for
 * aberta ao público, essa parte vai precisar de uma solução própria nesta
 * hospedagem (ex.: expor a config via endpoint/script do servidor).
 */
function readRuntimeEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export function getSupabaseEnv() {
  return {
    url: readRuntimeEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: readRuntimeEnv(
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  };
}
