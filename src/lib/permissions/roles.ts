import type { Session } from "@/lib/auth/dal";
import type { StaffRole } from "@/types/database";

/**
 * RBAC (seção 34/38) — checagens de papel reutilizáveis por Server
 * Components, Server Actions e Route Handlers. Recebem sempre a `Session`
 * já verificada por `requireSession()`/`getSession()` (ver `lib/auth/dal.ts`)
 * — este módulo nunca lê cookies/sessão sozinho, só decide "pode ou não" a
 * partir do que a DAL já validou.
 */

export function hasStaffRole(session: Session, ...roles: StaffRole[]): boolean {
  return session.isWjbStaff && !!session.staffRole && roles.includes(session.staffRole);
}

export function isSuperAdmin(session: Session): boolean {
  return hasStaffRole(session, "super_admin");
}

/** Contador e super_admin lidam com obrigações/documentos fiscais dos clientes. */
export function canManageObligations(session: Session): boolean {
  return hasStaffRole(session, "super_admin", "contador");
}

/** Qualquer papel de staff pode atender tickets/mensagens (SAAS FASE 3/4). */
export function canHandleSupport(session: Session): boolean {
  return hasStaffRole(session, "super_admin", "contador", "atendimento");
}
