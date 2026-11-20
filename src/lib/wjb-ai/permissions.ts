import type { Session } from "@/lib/auth/dal";
import type { TenantMemberRole } from "@/types/database";

/**
 * Permissões do WJB AI (F1). Ficam separadas de `src/lib/permissions` de
 * propósito: o módulo é novo e desligado, e mexer nas listas já validadas em
 * produção traria risco de regressão sem ganho agora.
 *
 * Mapeamento com os papéis do documento mestre:
 * - CLIENT_OWNER   -> tenant `owner`
 * - CLIENT_OPERATOR-> tenant `member`
 * - WJB_CONTADOR   -> staff `contador`
 * - WJB_ATENDENTE  -> staff `atendimento` (acompanha, não aprova nem envia)
 * - WJB_SUPER_ADMIN-> staff `super_admin` (configura; NÃO equivale a
 *   autorização fiscal: `fiscal.submit` não é dado a ninguém neste incremento)
 * - WJB_FISCAL_ADMIN: sem equivalente no banco ainda (pendência em
 *   docs/wjb-ai/12-PENDENCIAS-E-DECISOES.md).
 */
export type WjbAiPermission =
  | "fiscal.draft.create"
  | "fiscal.request.read"
  | "fiscal.review"
  | "fiscal.profile.manage"
  | "fiscal.submit";

const TENANT: Record<TenantMemberRole, WjbAiPermission[]> = {
  owner: ["fiscal.draft.create", "fiscal.request.read"],
  member: ["fiscal.draft.create", "fiscal.request.read"],
};

const STAFF: Record<NonNullable<Session["staffRole"]>, WjbAiPermission[]> = {
  super_admin: [
    "fiscal.request.read",
    "fiscal.review",
    "fiscal.profile.manage",
  ],
  contador: ["fiscal.request.read", "fiscal.review", "fiscal.profile.manage"],
  atendimento: ["fiscal.request.read"],
};

export function getWjbAiPermissions(
  session: Session,
  tenantRole?: TenantMemberRole | null,
): WjbAiPermission[] {
  if (session.isWjbStaff)
    return session.staffRole ? STAFF[session.staffRole] : [];
  return tenantRole ? TENANT[tenantRole] : [];
}

export function hasWjbAiPermission(
  session: Session,
  permission: WjbAiPermission,
  tenantRole?: TenantMemberRole | null,
): boolean {
  return getWjbAiPermissions(session, tenantRole).includes(permission);
}

/**
 * Isolamento por empresa: um cliente só enxerga registros da empresa ATIVA
 * da sessão (já revalidada por `getActiveTenant`). Nunca usa um `tenantId`
 * vindo do corpo, da URL, do LLM ou de webhook.
 */
export function canAccessTenantRecord(input: {
  session: Session;
  sessionTenantId: string | null;
  recordTenantId: string;
}): boolean {
  if (input.session.isWjbStaff) {
    return hasWjbAiPermission(input.session, "fiscal.request.read");
  }
  return (
    input.sessionTenantId !== null &&
    input.sessionTenantId === input.recordTenantId
  );
}
