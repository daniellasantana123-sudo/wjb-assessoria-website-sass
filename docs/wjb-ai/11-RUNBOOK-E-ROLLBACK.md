# 11 - Runbook e rollback

## Ligar / desligar o módulo
- `WJB_AI_ENABLED=true` no painel da Hostinger liga rota, ações e telas `/portal/nfse` (lido em runtime). **Só ligar depois da 0024 aplicada no mesmo banco.**
- **Parar tudo:** `WJB_AI_ENABLED=false`. Rota responde 404, telas 404, ações recusam.
- `WJB_AI_FISCAL_MODE` fica `mock`. `homologacao` e `producao` recusam até existir conector oficial aprovado.

## Reverter um deploy de código
O deploy é automático a cada push na `main` (Hostinger).
1. **Mais rápido:** painel da Hostinger > Implantações > reimplantar a versão anterior marcada como concluída.
2. **Definitivo:** `git revert <commit>` e `git push origin main` (gera um novo deploy sem a mudança). Commits do WJB AI: `a7d15d22` (F1) e os seguintes desta fase.
3. Conferir depois: `POST /api/wjb-ai/fiscal/drafts/preview` e as páginas existentes (`/`, `/login`, `/portal`, `/admin`).
O código do WJB AI não altera nenhuma funcionalidade existente, então reverter não afeta o restante.

## Aplicar a 0024 em produção (pendente de aprovação)
1. Homologação concluída (ver 17). Repetir `bash scripts/wjb-ai/homologacao/run.sh` com a versão final.
2. Supabase > Database > Backups: confirmar backup do dia; com plano pago, anotar o horário para PITR.
3. SQL Editor: colar `supabase/migrations/0024_wjb_ai_fiscal_core.sql` e executar.
4. Conferir: 7 tabelas `fiscal_*` com RLS ligada; `select count(*) from public.fiscal_requests;` = 0.
5. Nada é exposto até `WJB_AI_ENABLED=true`.

## Rollback da 0024
`scripts/wjb-ai/homologacao/03_rollback_0024.sql` (remove as 4 funções e as 7 tabelas). Testado na homologação: o banco volta exatamente ao estado anterior. Linhas já gravadas em `audit_log` permanecem como histórico.

## Recuperação se algo der errado depois de aplicar
Desligar o módulo (`WJB_AI_ENABLED=false`) -> exportar `fiscal_*` se houver dados a preservar -> rollback -> se necessário, restaurar o backup/PITR do passo 2.
