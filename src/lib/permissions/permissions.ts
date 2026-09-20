import type { Session } from "@/lib/auth/dal";
import type { StaffRole, TenantMemberRole } from "@/types/database";

/**
 * Camada de permissões finas (Fase 1 do wjb-saas-mvp, 2026-09-20) —
 * adicionada ao lado de `roles.ts` (não o substitui). O RBAC por papel
 * nomeado (`isSuperAdmin`, `canHandleSupport` etc.) continua sendo a forma
 * usada pelas Server Actions/páginas já existentes e testadas — mudar isso
 * seria reescrever autorização já validada em produção sem necessidade.
 * Esta camada existe pra código NOVO que prefira checar uma permissão
 * específica (`documents.upload`) em vez de reimplementar lógica de papel
 * toda vez — hoje usada em `/api/me` (ver route.ts).
 *
 * Os mapas abaixo refletem o que a aplicação REALMENTE aplica hoje, não uma
 * distribuição aspiracional: `contador` e `atendimento` têm as mesmas
 * permissões porque nenhum código atual diferencia os dois além de
 * `staff.manage` (exclusivo de `super_admin`) — `canManageObligations()` em
 * `roles.ts`, por exemplo, existe mas não é chamada em nenhuma Server Action
 * (obrigações/documentos usam `requireStaffSession()`, sem distinção de
 * staffRole). Se essa distinção passar a ser aplicada de verdade no futuro,
 * atualizar os mapas aqui é o único lugar a mudar.
 */

export type Permission =
  | "organizations.read"
  | "organizations.manage"
  | "members.read"
  | "members.invite"
  | "members.manage"
  | "documents.read"
  | "documents.upload"
  | "documents.delete"
  | "documents.manage"
  | "obligations.read"
  | "obligations.manage"
  | "tickets.read"
  | "tickets.create"
  | "tickets.manage"
  | "messages.read"
  | "messages.send"
  | "notifications.read"
  | "staff.manage"
  | "audit.read"
  | "integrations.read"
  | "integrations.manage";

const BASE_STAFF_PERMISSIONS: Permission[] = [
  "organizations.read",
  "organizations.manage",
  "members.read",
  "members.invite",
  "members.manage",
  "documents.read",
  "documents.upload",
  "documents.delete",
  "documents.manage",
  "obligations.read",
  "obligations.manage",
  "tickets.read",
  "tickets.create",
  "tickets.manage",
  "messages.read",
  "messages.send",
  "notifications.read",
  "audit.read",
  "integrations.read",
  "integrations.manage",
];

const STAFF_PERMISSIONS: Record<StaffRole, Permission[]> = {
  super_admin: [...BASE_STAFF_PERMISSIONS, "staff.manage"],
  contador: BASE_STAFF_PERMISSIONS,
  atendimento: BASE_STAFF_PERMISSIONS,
};

const TENANT_PERMISSIONS: Record<TenantMemberRole, Permission[]> = {
  owner: [
    "organizations.read",
    "members.read",
    "members.invite",
    "documents.read",
    "documents.upload",
    "obligations.read",
    "tickets.read",
    "tickets.create",
    "messages.read",
    "messages.send",
    "notifications.read",
    "integrations.read",
  ],
  member: [
    "organizations.read",
    "members.read",
    "documents.read",
    "documents.upload",
    "obligations.read",
    "tickets.read",
    "tickets.create",
    "messages.read",
    "messages.send",
    "notifications.read",
    "integrations.read",
  ],
};

/**
 * Permissões efetivas da sessão. Para cliente (não staff), `tenantRole`
 * precisa vir de `getTenantRole(tenantId)` — chamada async que só quem já
 * tem o `tenantId` em mãos pode fazer, por isso não é resolvida aqui dentro.
 */
export function getPermissions(
  session: Session,
  tenantRole?: TenantMemberRole | null,
): Permission[] {
  if (session.isWjbStaff) {
    return session.staffRole ? STAFF_PERMISSIONS[session.staffRole] : [];
  }
  return tenantRole ? TENANT_PERMISSIONS[tenantRole] : [];
}

export function hasPermission(
  session: Session,
  permission: Permission,
  tenantRole?: TenantMemberRole | null,
): boolean {
  return getPermissions(session, tenantRole).includes(permission);
}
