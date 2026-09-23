import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

import { getSupabaseEnv } from "./env";

/**
 * Há credenciais de Supabase no ambiente? (2026-09-23) Mesmo guard que
 * `src/proxy.ts` já fazia desde a FASE 1 do SaaS: sem as env vars,
 * `createServerClient` lança ("Your project's URL and Key are required"),
 * então quem roda em rota pública precisa checar antes em vez de quebrar.
 * Bug real que isso corrige: `/api/leads` (formulários da V1, incluindo o
 * Assistente Virtual) chamava `createClient()` direto e devolvia 500 em
 * produção - ou seja, o site de marketing inteiro parou de captar lead por
 * depender de uma infra de SaaS que ainda não está provisionada lá.
 */
export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
}

/**
 * Client Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a chave anônima + os cookies da sessão do usuário — a RLS continua
 * valendo (mesmo comportamento do client do navegador, só que no servidor).
 *
 * `setAll` pode falhar quando chamado a partir de um Server Component puro
 * (não pode escrever cookies fora de Server Action/Route Handler) — o
 * try/catch é intencional: o `proxy.ts` já cuida de renovar a sessão a cada
 * request, então um Server Component só *lendo* a sessão pode ignorar essa
 * falha com segurança.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component — o proxy.ts já renova a sessão.
        }
      },
    },
  });
}
