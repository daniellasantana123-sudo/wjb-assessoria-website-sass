import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Client Supabase para uso em Client Components ("use client"). Só enxerga
 * o que a RLS libera para o usuário autenticado no navegador — nunca usar
 * a service role key aqui (ver `admin.ts`).
 *
 * **ATENÇÃO (2026-09-23): hoje nada importa este arquivo, e ele NÃO
 * funciona nesta hospedagem como está.** As duas variáveis abaixo são
 * substituídas pelo valor durante o build, e a Hostinger só injeta as
 * variáveis do painel no processo em execução - o navegador receberia
 * `undefined` nas duas. Todo acesso autenticado hoje passa por Server
 * Action/Server Component (`server.ts`, que lê em runtime via
 * `./env`), e é por isso que o login funciona.
 *
 * Antes de ligar qualquer Client Component nisto, resolver o transporte
 * dos valores pro navegador - ex.: um Server Component renderizando os
 * valores (que são públicos por design) e passando por prop/script.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
