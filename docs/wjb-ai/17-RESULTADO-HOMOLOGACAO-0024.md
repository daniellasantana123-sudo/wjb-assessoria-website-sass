# 17 - Resultado da homologação da migration 0024

**Data:** 20/11/2026 · **Onde:** Postgres 17 (imagem `postgres:17-alpine`) local, em contêiner Docker descartável, **isolado do Supabase de produção** · **Dados:** 100% fictícios.

**Limite desta homologação:** o banco reproduz as partes do Supabase usadas pelas migrations (`auth.users`, `auth.uid()`, papéis `anon`/`authenticated`/`service_role`, `storage.objects`), mas não roda PostgREST, GoTrue nem a Storage API. RLS, funções, gatilhos, chaves e restrições são do Postgres real e foram testados de verdade; o caminho completo aplicação -> PostgREST -> banco não foi exercitado aqui e precisa ser repetido num projeto Supabase de homologação (ver 16).

**Como repetir:** `bash scripts/wjb-ai/homologacao/run.sh` (sobe, testa e apaga o contêiner; `KEEP=1` mantém).

## Saída da execução
```text
== 1. Schema atual (shim do Supabase + migrations 0001 a 0023)
   ok: 23 migrations aplicadas
== 2. Backup e teste de restauração (antes da 0024)
   original:   obligations=2 profiles=7 tabelas=13 tenant_members=2 tenants=2
   restaurado: obligations=2 profiles=7 tabelas=13 tenant_members=2 tenants=2
   ok: restauração idêntica
== 3. Aplicando 0024
   ok: nenhuma coluna de tabela existente mudou
   tabelas novas: fiscal_authorization_grants, fiscal_issuance_attempts, fiscal_profile_approvals, fiscal_profile_approver_grants, fiscal_profiles, fiscal_request_events, fiscal_requests
   RLS ligada em: 7/7
== 4. Testes de RLS, isolamento, permissões e integridade
   OK  T01 cliente A não vê pedidos da empresa B
   OK  T02 cliente A vê só o próprio pedido
   OK  T03 cliente A não vê perfil fiscal da empresa B
   OK  T04 cliente A não cria pedido na empresa B (bloqueado: 42501)
   OK  T05 cliente cria pedido na própria empresa e consulta
   OK  T06 cliente não cria pedido já AUTORIZADA (bloqueado: 42501)
   OK  T07 cliente não cria pedido em nome de outra pessoa (bloqueado: 42501)
   OK  T08 mesma chave de idempotência na mesma empresa é recusada (bloqueado: 23505)
   OK  T09 cliente não altera pedido (sem policy de update)
   OK  T10 a mesma chave em OUTRA empresa é permitida (chave é por empresa)
   OK  T11 equipe move pedido para REVISAO_HUMANA
   OK  T12 equipe não marca AUTORIZADA (bloqueado: 42501)
   OK  T13 usuário não grava eventos (só o servidor) (bloqueado: 42501)
   OK  T14 usuário não grava tentativa de envio (bloqueado: 42501)
   OK  T15 segunda tentativa AUTORIZADA do mesmo pedido é recusada pelo banco (bloqueado: 23505)
   OK  T16 visitante anônimo não lê pedidos
   OK  T17 contador SEM concessão não aprova (bloqueado: 42501)
   OK  T18 aprovar editando a tabela direto é bloqueado (bloqueado: 42501)
   OK  T19 contador não concede permissão a si mesmo (bloqueado: 42501)
   OK  T20 permissão não pode ir para Atendimento (bloqueado: 22023)
   OK  T21 concessão exige motivo (bloqueado: 23514)
   OK  T22 concessões registradas no audit_log
   OK  T23 super_admin concede, mas não aprova perfil (bloqueado: 42501)
   OK  T24 contador sem concessão continua sem a permissão (não é automática)
   OK  T25 concessão restrita à empresa A não aprova a empresa B (bloqueado: 42501)
   OK  T26 aprovação exige justificativa (bloqueado: 22023)
   OK  T27 perfil aprovado registra quem e justificativa
   OK  T28 histórico registra empresa, versão e data
   OK  T29 aprovação no audit_log
   OK  T30 perfil aprovado é imutável (nova versão em vez de edição)
   OK  T31 revogação retira a permissão na hora
   OK  T32 contador suspenso perde a permissão mesmo com concessão ativa
   OK  T33 cliente não enxerga concessões
   OK  T34 pedido de empresa inexistente é recusado (FK) (bloqueado: 23503)
   OK  T35 apagar a empresa remove os dados fiscais dela em cascata
   OK  T36 dados da outra empresa intactos
   OK  T37 RLS de obrigações (tabela existente) inalterada
   OK  T38 RLS de empresas (tabela existente) inalterada
== 5. Rollback da 0024 (no banco restaurado)
   ok: rollback devolve o banco ao estado anterior
== Homologação concluída sem falhas
```

## Conclusão
- Backup e restauração testados **antes** da aplicação: restauração idêntica.
- 0024 não altera nenhuma coluna de tabela existente; 7 tabelas novas, todas com RLS.
- 38 verificações de RLS, isolamento, permissões, integridade referencial e regressão passaram.
- Rollback devolve o banco exatamente ao estado anterior.

**Não aplicada em produção.** Plano para produção em `11-RUNBOOK-E-ROLLBACK.md`, aguardando aprovação.
