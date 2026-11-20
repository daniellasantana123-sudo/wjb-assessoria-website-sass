# 13 - Relatório de implementação

## F0 - Auditoria (20/11/2026)
Concluída. Ver 00 a 07. Veredito: GO COM RESTRIÇÕES para F1-F3 em mock; NO-GO para LLM real e para homologação oficial até as pendências do 12.

## F1 - Primeiro incremento seguro (20/11/2026)

**Arquivos novos** (nenhum arquivo existente foi modificado):
- `src/lib/wjb-ai/config.ts` - interruptores em runtime, produção sempre bloqueada.
- `src/lib/wjb-ai/permissions.ts` - permissões do módulo e isolamento por empresa.
- `src/lib/wjb-ai/fiscal/status.ts` - máquina de estados.
- `src/lib/wjb-ai/fiscal/documents.ts` - CPF/CNPJ (inclusive alfanumérico).
- `src/lib/wjb-ai/fiscal/draft.ts` - schema estrito do rascunho.
- `src/lib/wjb-ai/fiscal/idempotency.ts` - chave no servidor.
- `src/lib/wjb-ai/fiscal/policy.ts` - Policy Engine determinístico.
- `src/lib/wjb-ai/fiscal/provider/` - contrato `FiscalProvider`, `MockFiscalProvider`, fábrica que recusa homologação/produção.
- `src/lib/wjb-ai/fiscal/preview.ts` + `src/app/api/wjb-ai/fiscal/drafts/preview/route.ts` - prévia sem gravação.
- `supabase/migrations/0024_wjb_ai_fiscal_core.sql` - **não aplicada**.
- `src/tests/unit/wjb-ai-fiscal.test.ts`, `src/tests/integration/wjb-ai-preview-api.test.ts` - 25 testes.
- `.claude/agents/wjb-*.md` - 14 papéis.

**Simulado:** todo resultado de emissão vem do `MockFiscalProvider` (`simulated: true`, ids `SIMULADO-`).
**Não validado:** documentação oficial, homologação, RLS da 0024 em banco real, IA.

## Publicação da F1 (20/11/2026)
`main` avançada para `a7d15d22` e publicada. Verificado em produção: `POST /api/wjb-ai/fiscal/drafts/preview` responde `{"ok":false,"error":"not_found"}` (404), `GET` responde 405; `/`, `/login`, `/area-do-cliente`, `/servicos/abrir-empresa` = 200; `/portal` e `/admin` = 307 para o login. Reversão documentada em 11.

## F2 - Homologação da 0024 e Solicitar NFS-e (20/11/2026)

**Migration 0024** (revisada): permissão granular `fiscal_profile.approve` (tabelas de concessão e histórico de aprovações; funções de conceder, revogar e aprovar com justificativa); perfil fiscal com no máximo um aprovado por empresa e imutável depois de aprovado. Homologada (38 verificações, backup/restauração, rollback). **Não aplicada em produção.**

**Arquivos novos:** `src/lib/wjb-ai/fiscal/{requests,requests.repo,labels,form}.ts`, `src/actions/wjb-ai-fiscal.ts`, `src/components/wjb-ai/{nfse-request-form,fiscal-status-badge}.tsx`, `src/app/portal/nfse/{page,nova/page,[id]/page}.tsx`, `scripts/wjb-ai/homologacao/*`, testes `wjb-ai-requests.test.ts` e `wjb-ai-nfse-form.test.tsx`, docs 14 a 17.

**Arquivos existentes alterados (só adição):** `src/types/database.ts`, `src/lib/audit-labels.ts`.

**Simulado / não validado:** nenhuma nota é emitida; o caminho aplicação -> PostgREST -> banco não foi exercitado (sem projeto Supabase de homologação); as telas foram testadas por renderização e tipos, não com login real.
