-- Fase 6 do wjb-saas-mvp (2026-09-20) - Notificações e suporte.
--
-- `notifications` já existia desde a SAAS FASE 3 (0015) - esta migration só
-- adiciona 2 colunas que o prompt desta fase pede explicitamente e que a
-- tabela ainda não tinha:
--   title: até agora só existia `body` (uma frase única). Título curto
--     separado permite a UI destacar "o quê" (título) de "o quê exatamente"
--     (corpo) - e-mail já tinha essa separação (`notificationEmailTitles`
--     em `src/lib/notifications.ts`), agora o in-app também tem.
--   metadata_sanitized: contexto extra não-sensível (ex.: nome do arquivo,
--     nome da empresa) - mesmo espírito de `audit_log.metadata`, nunca
--     dado sensível (a própria regra de nomear a coluna com "_sanitized"
--     é do próprio prompt).
--
-- `tenant_id`/`recipient_id` (já existentes) NÃO foram renomeados para
-- "organization_id"/"user_id" (nomenclatura do diagrama do prompt) -
-- manter a convenção já usada em toda outra tabela do projeto
-- (tickets, messages, obligations, documents, omie_client_mappings) é
-- mais importante que casar 1:1 com o nome de uma variável de um
-- documento de referência. Ver decisions.md D2.

alter table public.notifications
  add column title text not null default '',
  add column metadata_sanitized jsonb;

comment on column public.notifications.title is 'Título curto (ex.: "Novo documento disponível") - o corpo (`body`) continua com a frase completa.';
comment on column public.notifications.metadata_sanitized is 'Contexto extra não-sensível (nome de arquivo, nome de empresa) - nunca conteúdo de mensagem/documento em si.';
