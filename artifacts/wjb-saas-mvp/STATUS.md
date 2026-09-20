# Status - wjb-saas-mvp

## Fase atual

**Fase 3 - Documentos**: concluída em 2026-09-20.

## Progresso

| Fase | Status | Data |
|---|---|---|
| Fase 0 - Auditoria do estado atual | Concluída | 2026-09-20 |
| Fase 1 - Fundação Backend SaaS | Concluída | 2026-09-20 |
| Fase 2 - Auth, onboarding e Dashboard | Concluída | 2026-09-20 |
| Fase 3 - Documentos | Concluída | 2026-09-20 |

## Arquivos alterados nesta fase

- `src/lib/documents.ts` - reescrito: sem geração de URL em lote; `sanitizeFileName`, `ALLOWED_DOCUMENT_MIME_TYPES`/`isAllowedMimeType`, busca por `query` novos.
- `src/actions/documents.ts` - `uploadDocument`/`deleteDocument` endurecidos (permissão, MIME, antimalware, nome sanitizado).
- `src/app/api/documents/[id]/download/route.ts` - novo (download auditado, URL sob demanda).
- `src/integrations/antivirus/{types,provider,noop.adapter,index}.ts` - novo (Adapter Pattern, ponto de extensão).
- `src/lib/permissions/permissions.ts` - `documents.delete` adicionado.
- `src/components/documents/documents-list.tsx` - link de download atualizado, campo de busca novo.
- `src/app/portal/documentos/page.tsx`, `src/app/portal/guias/page.tsx` - leem `?q=`, passam `searchAction`.
- `src/app/portal/documentos/{loading,error}.tsx`, `src/app/portal/guias/{loading,error}.tsx` - novos.
- `src/components/shared/portal-error-state.tsx` - novo (compartilhado pelos `error.tsx` do Portal).
- `src/proxy.ts` - `/api/documents` adicionado ao gate do SaaS.
- 3 arquivos de teste novos (`documents` unit, `documents-download-api`, `documents-upload-action`).
- `artifacts/wjb-saas-mvp/fase-3/*` - criado.

Nenhuma migration nova, nenhuma dependência nova.

## Testes

Lint, typecheck, 99 testes (80 anteriores + 19 novos) e build de produção - todos passando. Detalhe completo em `fase-3/test-report.md`.

## Riscos

- Herdado da Fase 0: credenciais do projeto Supabase real ausentes em todos os ambientes acessíveis - módulo de documentos só testado via mock, não contra Storage/banco reais.
- Allowlist de MIME confia no `file.type` do navegador, não inspeciona bytes do arquivo - ver `fase-3/phase-handoff.md`.
- `sanitizeFileName` reduz acentos a underscore - trade-off de legibilidade vs. segurança de storage key.

## Bloqueios

Nenhum bloqueio impede a conclusão da Fase 3.

## Próxima fase

Não definida ainda - aguardando o próximo prompt numerado do usuário.

## Decisão de escopo importante (mantida desde a Fase 0)

A integração Omie.G-Click **não faz parte** deste projeto - decisão de produto de 2026-09-16, reconfirmada em 2026-09-20.
