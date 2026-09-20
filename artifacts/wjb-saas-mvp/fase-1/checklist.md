# Checklist de aceite - Fase 1

- [x] Users, organizations e memberships - já existentes (`profiles`, `tenants`, `tenant_members`), documentado o mapeamento em `architecture.md`. Não recriados/renomeados por decisão do usuário (ver `decisions.md` D1).
- [x] Roles e permissions - roles já existentes (`staff_role`, `tenant_members.role`); permissions finas criadas nesta fase (`src/lib/permissions/permissions.ts`).
- [x] Invitations - já existente via fluxo nativo do Supabase Auth (`inviteUserByEmail`), documentado.
- [x] Audit log - já existente (`audit_log`), documentado.
- [x] `/api/me` - criado nesta fase (`GET /api/me`, mais `GET /api/me/organizations`).
- [x] Tenant isolation - `organizationId` sempre derivado da sessão no servidor nas rotas novas, nunca aceito do cliente.
- [x] RLS quando aplicável - já implementado nas 15 migrations existentes (Fase 0); nenhuma tabela nova foi criada nesta fase, então nenhuma RLS nova foi necessária.
- [x] IDOR e cross-tenant bloqueados - rotas novas não aceitam `tenantId` do cliente; pentest de 2026-09-17 (já documentado na Fase 0) cobre o restante do app.
- [x] Build passando - `npm run build`, 78 rotas (76 anteriores + `/api/me` + `/api/me/organizations`).

## Notas sobre desvios do prompt original (todos aprovados pelo usuário)

- Tabelas `organizations`/`memberships`/`invitations`/`sessions` não foram criadas como pedido - já existem com outros nomes (ver `decisions.md` D1).
- Só 2 dos ~6 endpoints REST pedidos foram criados (ver `decisions.md` D3).
