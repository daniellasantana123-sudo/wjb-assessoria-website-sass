-- Sincronização de obrigações a partir do Omie.G-Click (2026-09-24).
--
-- Até aqui `obligations` só guardava o que a WJB digitava na plataforma.
-- Com a sincronização, a mesma tabela passa a receber linhas espelhadas de
-- um sistema externo - e precisa distinguir as duas origens por três
-- motivos concretos:
--
--   1) Idempotência: sem um identificador externo, cada sincronização
--      criaria tudo de novo. O índice único abaixo é o que garante
--      "atualiza se já existe, cria se não existe" no próprio banco, sem
--      depender da aplicação acertar.
--   2) Autoridade: uma obrigação criada à mão pela WJB (external_id nulo)
--      NUNCA pode ser sobrescrita por uma sincronização. Só linhas que
--      vieram de fora são atualizadas de fora.
--   3) Transparência: a interface pode dizer ao cliente de onde veio o
--      prazo, em vez de apresentar tudo como se tivesse sido lançado
--      manualmente.
--
-- `external_source` é um check e não um enum de propósito: diferente de
-- status (um domínio fechado do produto), a lista de sistemas integrados
-- tende a crescer, e um check é alterado sem os cuidados de um `alter
-- type` em coluna já usada.

alter table public.obligations
  add column external_id text,
  add column external_source text
    check (external_source is null or external_source in ('omie_gclick')),
  add column external_synced_at timestamptz;

-- Parcial (`where external_id is not null`): as obrigações lançadas à mão
-- continuam podendo repetir à vontade - o índice só governa o que veio de
-- um sistema externo.
create unique index obligations_external_identity_idx
  on public.obligations (tenant_id, external_source, external_id)
  where external_id is not null;

comment on column public.obligations.external_id is
  'Identificador da tarefa no sistema externo. Nulo = obrigação criada manualmente pela WJB, que a sincronização nunca toca.';
comment on column public.obligations.external_source is
  'Sistema de origem quando a obrigação veio de fora (hoje só omie_gclick).';
comment on column public.obligations.external_synced_at is
  'Quando esta linha foi conferida pela última vez contra o sistema externo.';

-- Nenhuma policy nova: obligations_select_staff_or_tenant_member e
-- obligations_write_staff_only (0008) são row-level, não column-level, e
-- já cobrem as colunas novas.
