# Plano de implementação - Fase 0

Nenhuma feature nova foi implementada nesta fase, conforme instrução do próprio prompt ("Não implementar novas features nesta fase"). As únicas mudanças no repositório são de organização (ver `decisions.md` D4).

## Candidatos para a próxima fase (propostas, não decisões)

Estes itens vêm diretamente dos achados da auditoria - nenhum foi inventado, e nenhum está priorizado ainda. Cabe ao usuário decidir a ordem e o que entra de fato na próxima fase:

1. **Reconectar o projeto Supabase real** (`wjb-website-app`) - recuperar URL/anon key/service role key e configurar em `.env.local` (dev) e no ambiente da Hostinger. Bloqueia qualquer trabalho que precise de banco real (testes E2E do SaaS, novas migrations, `gen types`).
2. **Recriar `.env.example`** - lista de variáveis já conhecida, ver `decisions.md` D3.
3. **Recriar `.github/workflows/`** (CI: lint/typecheck/test/build; E2E: Playwright) - hoje essas verificações só rodam manualmente.
4. **Gerar `src/types/database.ts` automaticamente** via `supabase gen types typescript`, substituindo o arquivo mantido à mão, assim que o projeto estiver reconectado (item 1).
5. **Decidir sobre publicar o SaaS ao público** (`NEXT_PUBLIC_SAAS_PUBLIC_ENABLED=true`) - depende de decisão de negócio, não é bloqueio técnico.

Nenhum destes itens depende de Omie/G-Click (item descartado, ver `decisions.md` D1).
