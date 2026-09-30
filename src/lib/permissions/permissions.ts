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
 * Os mapas abaixo refletem o que a aplicação REALMENTE aplica: as Server
 * Actions de documentos, obrigações e integração checam estas permissões
 * no servidor (não só escondem botões).
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
  | "integrations.manage"
  | "feature_flags.manage"
  | "tenants.suspend";

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

/**
 * Atendimento (2026-09-30, decisão do usuário): cuida do relacionamento -
 * chamados, mensagens, leads, convites e envio de arquivos - mas não apaga
 * documentos, não lança/conclui/apaga obrigações e não mexe na integração
 * G-Click. Essas ficam com Contador e Super admin. Antes os dois papéis
 * eram idênticos.
 */
const ATENDIMENTO_BLOCKED: Permission[] = [
  "documents.delete",
  "documents.manage",
  "obligations.manage",
  "integrations.manage",
];

const STAFF_PERMISSIONS: Record<StaffRole, Permission[]> = {
  super_admin: [...BASE_STAFF_PERMISSIONS, "staff.manage", "feature_flags.manage", "tenants.suspend"],
  contador: BASE_STAFF_PERMISSIONS,
  atendimento: BASE_STAFF_PERMISSIONS.filter((p) => !ATENDIMENTO_BLOCKED.includes(p)),
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
