import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Client Supabase com a service role key — ignora RLS por completo. Só para
 * rotinas de servidor que precisam operar entre tenants (ex.: sincronização
 * de integrações, jobs administrativos). `import "server-only"` garante um
 * erro de build se isso for importado por engano num Client Component.
 * NUNCA expor `SUPABASE_SERVICE_ROLE_KEY` (sem o prefixo `NEXT_PUBLIC_`,
 * de propósito) fora deste arquivo.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
