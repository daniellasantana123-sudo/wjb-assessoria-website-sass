import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Client Supabase para uso em Client Components ("use client"). Só enxerga
 * o que a RLS libera para o usuário autenticado no navegador — nunca usar
 * a service role key aqui (ver `admin.ts`).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
