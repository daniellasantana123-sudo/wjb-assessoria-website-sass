import "server-only";

import { requireSession, type Session } from "@/lib/auth/dal";
import { isRateLimited } from "@/lib/security/rate-limit";
import { getActiveTenant } from "@/lib/tenant";

/**
 * Quem pode contratar, pagar, trocar ou cancelar: o RESPONSÁVEL (owner) da
 * empresa ativa, nunca a equipe WJB pela conta do cliente. Empresa sempre da
 * sessão. Fora de arquivo "use server" de propósito (não vira ação pública).
 */
export async function requireOwnerContext(scope: string): Promise<{ session: Session; tenantId: string } | { error: string }> {
  const session = await requireSession();
  if (session.isWjbStaff) return { error: "A contratação é feita pela conta do cliente." };
  if (isRateLimited(`${scope}:${session.userId}`, 10)) return { error: "Muitas tentativas. Aguarde um minuto." };
  const tenant = await getActiveTenant(session.userId);
  if (!tenant) return { error: "Nenhuma empresa vinculada à sua conta." };
  if (tenant.role !== "owner") return { error: "Só o responsável pela empresa pode contratar ou alterar o plano." };
  return { session, tenantId: tenant.id };
}
