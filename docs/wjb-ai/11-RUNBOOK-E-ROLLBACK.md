# 11 - Runbook e rollback

## Ligar / desligar
- Ligar a prévia: `WJB_AI_ENABLED=true` no painel da Hostinger (lido em runtime, sem novo build).
- **Parar tudo:** `WJB_AI_ENABLED=false`. As rotas voltam a 404 imediatamente.
- `WJB_AI_FISCAL_MODE` fica `mock`. `homologacao` e `producao` recusam até existir conector oficial aprovado.

## Aplicar a migration 0024 (só com aprovação)
1. Backup do banco no painel do Supabase.
2. SQL Editor: colar `0024_wjb_ai_fiscal_core.sql` e executar.
3. Conferir: `select count(*) from public.fiscal_requests;` deve responder 0.

## Rollback da 0024
```sql
drop table if exists public.fiscal_issuance_attempts, public.fiscal_request_events,
  public.fiscal_requests, public.fiscal_authorization_grants, public.fiscal_profiles;
```
Nenhuma tabela existente é alterada pela 0024, então o rollback não afeta o resto da plataforma.

## Rollback do código
Reverter o commit do F1. Nenhum arquivo existente foi modificado.
