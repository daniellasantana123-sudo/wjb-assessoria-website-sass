-- Fase 2 do wjb-saas-mvp (2026-09-20) — suspensão de conta e de vínculo com
-- empresa. Dois níveis independentes, de propósito:
--   profiles.status: bloqueia o LOGIN inteiro (staff ou cliente), checado
--     em getSession() (src/lib/auth/dal.ts) — a próxima página carregada
--     trata a pessoa como deslogada, sem precisar esperar o JWT expirar.
--   tenant_members.status: bloqueia só o acesso a UMA empresa específica,
--     sem mexer na conta nem em outros vínculos — checado em getTenantRole().
-- Nenhuma policy de RLS nova é necessária: profiles_update_super_admin
-- (0011) já cobre update de qualquer coluna por super_admin, e
-- tenant_members_update_staff_only (0006) já cobre update de qualquer
-- coluna por staff — ambas row-level, não column-level.
-- Enum de verdade (create type), não `text check` — mesma convenção das
-- demais colunas de status do projeto (tenant_member_role, staff_role,
-- obligation_status, lead_status, ticket_status).

create type public.account_status as enum ('active', 'suspended');

alter table public.profiles
  add column status public.account_status not null default 'active';

alter table public.tenant_members
  add column status public.account_status not null default 'active';

comment on column public.profiles.status is
  'active: login normal. suspended: getSession() trata como sem sessão (redireciona pro login).';
comment on column public.tenant_members.status is
  'active: acesso normal àquela empresa. suspended: getTenantRole() retorna null só pra essa empresa, sem afetar a conta ou outros vínculos.';
