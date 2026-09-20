# Plano de implementação - Fase 4

1. Resolver a contradição de escopo com o usuário antes de escrever qualquer código (feito via `AskUserQuestion`).
2. Migration `0017_omie_gclick_integration.sql`: enum `omie_integration_status` + tabela `omie_client_mappings`, RLS staff-write/tenant-read (mesmo padrão de `obligations`).
3. Tipos manuais em `src/types/database.ts` (mesma convenção do projeto - sem projeto Supabase real conectado para gerar tipos automaticamente, herdado da Fase 0).
4. Adapter Pattern em `src/integrations/omie-gclick/` - `types.ts`, `provider.ts` (fallback no-op), `omie.adapter.ts` (chamada real ao recurso "clientes" do Omie).
5. Permissões novas (`integrations.read`/`integrations.manage`) em `src/lib/permissions/permissions.ts`.
6. Validação (`src/lib/validation/omie-gclick.ts`) e leitura (`src/lib/omie-gclick.ts`).
7. Server Actions (`src/actions/omie-gclick.ts`): `saveOmieMapping`, `syncOmieClient`, `setOmieMappingDisabled` - todas staff-only, com auditoria sanitizada.
8. UI de staff (`OmieMappingPanel`) em `/admin/empresas/[id]`.
9. UI de cliente (`OmiePortalCta`) em `/portal`.
10. Testes (adapter + actions + permissão).
11. Lint, typecheck, test, build.
12. Reverter a decisão em `docs/product/roadmap.md`/`docs/api/integrations.md`, documentar a reversão nos artifacts da Fase 0 (sem editar retroativamente o que já estava escrito lá).
13. Escrever os 7 artifacts + atualizar `STATUS.md`.

Nenhum item deste plano dependia de credenciais Supabase reais além do que as Fases 1-3 já dependiam (mock em testes, mesma limitação herdada).
