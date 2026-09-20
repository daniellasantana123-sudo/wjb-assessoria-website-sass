# Checklist de aceite - Fase 3

- [x] Upload privado - já existia (bucket privado, RLS por tenant), agora com allowlist de MIME, nome sanitizado e ponto de extensão de antimalware.
- [x] Download autorizado - nova rota `GET /api/documents/[id]/download`, RLS + `hasPermission` checados antes de gerar qualquer URL.
- [x] Signed URL - já existia (10 min, em lote); agora gerada sob demanda por download (60s).
- [x] Cross-tenant bloqueado - RLS já garantia isso; a nova rota de download reforça com `hasPermission`, nunca aceita `tenantId` do cliente.
- [x] MIME e tamanho validados - tamanho já existia (20MB); MIME é novo (`ALLOWED_DOCUMENT_MIME_TYPES`).
- [x] Audit log - `document.uploaded`/`document.deleted` já existiam; `document.downloaded` é novo. `document.category_changed` não implementado (ver `decisions.md` D4 - funcionalidade não existe).
- [x] Mobile validado - reaproveita componentes já responsivos (`Input`, formulários existentes); nenhum layout novo complexo.
- [x] Security tests - allowlist de MIME, sanitização de nome, permissão, isolamento por RLS (via teste de "documento de outra empresa não retorna") todos cobertos por teste automatizado.

## Itens adicionais do prompt

- [x] Busca - por nome de arquivo, em `/portal/documentos` e `/portal/guias` (ver `decisions.md` D2 pro escopo).
- [x] Filtros - categoria (já existia) + busca (nova). Ver `decisions.md` D3.
- [x] Estados loading/empty/error - `loading.tsx`/`error.tsx` novos; `empty` já existia (mensagem quando a lista está vazia), agora com mensagem diferenciada quando é "sem resultado de busca" vs. "nunca teve documento".
- [x] Permissions (`documents.read/upload/delete/manage`) - `documents.delete` era o único que faltava no `Permission` union; todos os 4 agora existem e os 3 primeiros são checados de verdade em código.

## Verificação técnica

- [x] Lint limpo.
- [x] Typecheck limpo.
- [x] 99 testes passando (19 novos desta fase).
- [x] Build limpo, incluindo a rota nova `/api/documents/[id]/download`.
