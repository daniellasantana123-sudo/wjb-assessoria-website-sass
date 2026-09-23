import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSupabaseEnv } from "./env";

/**
 * Client Supabase com a service role key — ignora RLS por completo. Só para
 * rotinas de servidor que precisam operar entre tenants (ex.: sincronização
 * de integrações, jobs administrativos). `import "server-only"` garante um
 * erro de build se isso for importado por engano num Client Component.
 * NUNCA expor `SUPABASE_SERVICE_ROLE_KEY` (sem o prefixo `NEXT_PUBLIC_`,
 * de propósito) fora deste arquivo.
 *
 * A URL vem de `getSupabaseEnv()` (2026-09-23) pelo mesmo motivo do
 * `server.ts`: lida em tempo de execução, já que o build desta hospedagem
 * não recebe as variáveis do painel.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();

  return createSupabaseClient<Database>(
    url!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
