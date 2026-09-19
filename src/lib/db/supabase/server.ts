import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

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

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );
}
