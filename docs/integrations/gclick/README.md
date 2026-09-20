# Integração Omie.G-Click

## Status

```text
Modo ativo: mock (GCLICK_MODE, padrão quando ausente)
Integração real: BLOCKED_BY_PROVIDER (não implementada - schema técnico oficial não confirmado)
```

## O que existe

- `src/integrations/omie-gclick/` - contrato (`OmieGClickAdapter`), DTOs, provider mock funcional, esqueleto do provider real, mappers-esqueleto, config, fixtures.
- `src/actions/omie-gclick.ts` - Server Actions (`saveOmieMapping`, `syncOmieClient`, `setOmieMappingDisabled`, `testOmieConnection`), staff-only, usam o contrato acima - nunca a API externa diretamente.
- `omie_client_mappings` (Postgres, `supabase/migrations/0017_omie_gclick_integration.sql`) - mapeamento 1:1 tenant -> cliente externo, RLS staff-write/tenant-read.
- UI: painel por empresa (`/admin/empresas/[id]`) e visão geral (`/admin/integracoes`), ambos mostram o modo ativo (mock/sandbox/production) e nunca apresentam um resultado simulado como conexão real.

## Como trocar de modo

```env
GCLICK_MODE=mock        # padrão - único modo funcional hoje
GCLICK_MODE=sandbox     # sempre bloqueado (PROVIDER_NOT_CONFIGURED)
GCLICK_MODE=production  # sempre bloqueado, mesmo com GCLICK_REAL_INTEGRATION_ENABLED=true
```

Não existe hoje nenhum cenário em que `sandbox`/`production` façam uma chamada de rede real - a implementação (`GClickHttpProvider`) é um esqueleto que sempre resolve `PROVIDER_NOT_CONFIGURED`. Ver `ARCHITECTURE.md` e `PENDING_VALIDATION.md`.

## Documentos relacionados

- `ARCHITECTURE.md` - como as peças se encaixam.
- `PENDING_VALIDATION.md` - tudo que depende de confirmação oficial da Omie/G-Click.
- `MOCK_SCENARIOS.md` - cenários simuláveis no `MockGClickProvider`.
- `GCLICK_MAPPING_PENDING.md` - matriz de mapeamento modelo interno x campo externo (toda a coluna externa em aberto).
- `../../../artifacts/wjb-saas-mvp/fase-6-5/` - auditoria técnica anterior (confirmou que a implementação da Fase 4 usava a API errada - Omie ERP, não G-Click).
