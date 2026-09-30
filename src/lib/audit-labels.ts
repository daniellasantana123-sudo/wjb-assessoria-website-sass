/**
 * Rótulo em português de cada ação gravada em `audit_log`, usado em
 * /admin/logs (lista e filtro "Ação"). Toda ação nova gravada no código
 * precisa de rótulo aqui - `src/tests/unit/audit-labels.test.ts` falha se
 * alguma ficar sem (2026-09-30: chamados, mensagens e duas ações do G-Click
 * apareciam com o código técnico e não entravam no filtro).
 */
export const auditActionLabels: Record<string, string> = {
  "tenant.created": "Empresa criada",
  "tenant.updated": "Empresa editada",
  "tenant.suspended": "Empresa suspensa",
  "tenant.reactivated": "Empresa reativada",
  "tenant_member.invited": "Pessoa convidada",
  "tenant_member.invite_resent": "Convite reenviado",
  "tenant_member.role_changed": "Papel alterado",
  "tenant_member.suspended": "Vínculo suspenso",
  "tenant_member.reactivated": "Vínculo reativado",
  "tenant_member.access_revoked": "Acesso revogado",
  "staff.invited": "Acesso interno concedido",
  "staff.invite_resent": "Convite interno reenviado",
  "staff.role_changed": "Papel interno alterado",
  "staff.access_revoked": "Acesso interno revogado",
  "account.suspended": "Conta suspensa",
  "account.reactivated": "Conta reativada",
  "document.uploaded": "Documento enviado",
  "document.deleted": "Documento apagado",
  "document.downloaded": "Documento baixado",
  "obligation.created": "Obrigação criada",
  "obligation.status_changed": "Status da obrigação alterado",
  "obligation.deleted": "Obrigação apagada",
  "lead.status_changed": "Status do lead alterado",
  "integration.omie_mapping_updated": "Mapeamento Omie atualizado",
  "integration.omie_sync_attempted": "Sincronização Omie",
  "integration.omie_disabled": "Integração Omie desativada",
  "integration.omie_reactivated": "Integração Omie reativada",
  "integration.omie_connection_tested": "Conexão Omie testada",
  "integration.omie_linked_existing": "Empresa vinculada ao cadastro existente no G-Click",
  "integration.omie_obligations_synced": "Obrigações sincronizadas do G-Click",
  "ticket.created": "Chamado aberto",
  "ticket.replied": "Resposta em chamado",
  "ticket.status_changed": "Status do chamado alterado",
  "message.sent": "Mensagem enviada",
  "feature_flag.updated": "Feature flag alterada",
};
