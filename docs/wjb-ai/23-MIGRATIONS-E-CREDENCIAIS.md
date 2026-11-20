# 23 - Dependências das migrations do WJB AI e verificação de credenciais

## Migrations (todas aditivas; aplicadas só na homologação)
| Migration | Cria | Depende de | Rollback |
| --- | --- | --- | --- |
| 0024 `wjb_ai_fiscal_core` | 7 tabelas `fiscal_*`, 4 funções (`can_approve_fiscal_profile`, `grant_/revoke_fiscal_profile_approver`, `approve_fiscal_profile`), RLS | 0001 (`tenants`, `profiles`, `audit_log`, `is_staff`), 0011+0021 (`is_super_admin` considerando status), 0016 (`account_status`: `profiles.status`), 0018 (`tenants.status`, `my_tenant_ids` com status), `auth.uid()` do Supabase | `scripts/wjb-ai/homologacao/03_rollback_0024.sql` |
| 0025 `wjb_ai_fiscal_queue` | colunas de fila em `fiscal_requests`, `actor_kind` em `fiscal_request_events`, índice da fila | 0024 | `04_rollback_0025.sql` |
| 0026 `wjb_ai_fiscal_request_versions` | `fiscal_request_versions` (versões de pedidos corrigidos), RLS só leitura | 0024; 0018/0021 (`my_tenant_ids`, `is_staff`) | `05_rollback_0026.sql` |

- **Ordem obrigatória:** 0024 -> 0025 -> 0026. Rollback na ordem inversa.
- **Interação conhecida:** a 0022 (guarda de colunas privilegiadas de `profiles`) bloqueia mudança de `status`/papel por usuário logado; scripts de teste usam service role ou sessão sem JWT.
- **Projetos Supabase novos** (como a homologação) já vêm com privilégios padrão revogados e o gatilho `ensure_rls`; a 0002 restaura os privilégios e todas as tabelas ligam RLS explicitamente, então o comportamento é igual ao da produção.
- **Validação:** `bash scripts/wjb-ai/homologacao/run.sh` (Postgres 17 local: aplica 0001-0026, 38 testes de RLS, backup/restauração e rollback das três) e `node scripts/wjb-ai/homologacao-supabase/01-migrations.mjs` (registro com sha256 na homologação real).

## Credenciais (20/11/2026)
| Verificação | Resultado |
| --- | --- |
| Chave secreta `default` (final `…myoIzfFl`), exposta no chat | **Revogada**: removida da lista no painel; chamada com ela responde **401** |
| Chave nova `scripts_homologacao` | em uso; responde 200 na API administrativa |
| Histórico do Git (todas as branches) | nenhuma chave `sb_secret_`, string de conexão com senha ou token JWT |
| Arquivos versionados de ambiente | só `.env.example` (sem valores) |
| Documentação, logs locais, resultados de teste | nenhuma chave secreta |
| Chaves "Legacy" (formato antigo) do projeto de homologação | continuam ativas no painel; não foram expostas e o código não as usa. Recomendação: desligar (ação do proprietário) |
| Testes de autenticação e segurança reexecutados | 37/37 pela API real (inclui versões, 0026) e 15/15 E2E com login real |
