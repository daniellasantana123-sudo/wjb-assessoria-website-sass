# Arquitetura - Fase 3

## O que já existia (SAAS FASE 2, 2026-09-16)

- Tabela `public.documents` (`0005_documents_table.sql`): `id, tenant_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, category, created_at`. RLS: staff vê/gerencia tudo, membro só a própria empresa, apagar é staff-only.
- Bucket privado `documents` no Storage (`0004_storage_documents.sql`), RLS por `(storage.foldername(name))[1] = tenant_id`.
- `category` (`documento`/`guia`, `0009_document_category.sql`) - Guias reaproveita a mesma tabela, não é uma feature separada.
- Upload/exclusão via Server Actions (`src/actions/documents.ts`), com `tenant_id`/`storage_path` sempre derivados do próprio registro no banco (nunca de parâmetro do cliente) - correção do pentest de 2026-09-17.
- Limite de 20MB, auditoria de `document.uploaded`/`document.deleted`.

## O que mudou nesta fase

### Download (antes: link direto; agora: rota auditada)

**Antes**: `listTenantDocuments()` gerava uma URL assinada (10 min) em lote pra cada documento da lista, toda vez que a página carregava - útil pra evitar N+1 de chamadas ao Storage, mas isso significava que "gerar a URL" e "baixar de fato" eram a mesma coisa do ponto de vista do sistema, então não dava pra saber quando alguém realmente clicou.

**Agora**: `src/app/api/documents/[id]/download/route.ts` - `listTenantDocuments()` não gera mais nenhuma URL; a lista só linka pra essa rota. A rota:
1. Busca o documento com o client normal (RLS) - um `id` de outra empresa simplesmente não retorna nada, é a própria RLS que garante isolamento.
2. Confirma sessão (`getSession()`, 401 sem ela).
3. Checa `hasPermission(session, "documents.read", tenantRole)` - defesa em profundidade, não o mecanismo do qual o isolamento depende (isso é a RLS acima).
4. Gera uma URL assinada nova, de **60 segundos** (mais curta que os 10 minutos de antes - tempo só pro redirect completar, não pra guardar/compartilhar o link depois).
5. Grava `document.downloaded` no `audit_log`.
6. Redireciona (307) pra URL assinada.

### Segurança de upload

`src/lib/documents.ts` ganhou:
- `ALLOWED_DOCUMENT_MIME_TYPES` - PDF, PNG/JPEG/WebP, texto/CSV/XML, Word, Excel. Escolhidos pelo uso legítimo num escritório de contabilidade (a WJB troca documento fiscal, planilha, XML de nota fiscal com clientes) - não é uma lista genérica "todo tipo de arquivo do mundo", é deliberadamente restritiva.
- `sanitizeFileName(rawName)` - remove separador de caminho (`/`, `\`), caracteres de controle, reduz qualquer coisa fora de `[a-zA-Z0-9._-]` pra underscore, remove pontos no início, limita a 200 caracteres, nunca retorna vazio (`"arquivo"` como fallback).

`uploadDocument` (`src/actions/documents.ts`) passou a checar, nesta ordem: permissão (`hasPermission`) → tamanho → MIME → antimalware → só então sanitiza o nome e faz upload.

### Ponto de extensão para antimalware

`src/integrations/antivirus/{types,provider,noop.adapter,index}.ts` - mesmo Adapter Pattern de `email`/`whatsapp-business` (`docs/api/integrations.md`). Hoje sempre retorna `{ clean: true }` porque nenhum provider foi confirmado (seção 36 de `Wjb-Website.md`: "Somente implementar após confirmar API oficial, plano, credenciais e documentação") - mas o ponto de chamada em `uploadDocument` já existe, então plugar um provider real no futuro é só trocar o que `getAntivirusAdapter()` retorna.

### Permissões finas, finalmente usadas

A Fase 1 criou `documents.read`/`documents.upload`/`documents.manage` mas nada os chamava. Esta fase:
- Adicionou `documents.delete` ao `Permission` union e a `STAFF_PERMISSIONS` (só staff tem, igual à RLS).
- `uploadDocument` checa `documents.upload`.
- `deleteDocument` checa `documents.delete`.
- A nova rota de download checa `documents.read`.

### Busca

`listTenantDocuments(tenantId, category?, query?)` - `query` filtra por `file_name` via `ilike` (case-insensitive). UI: um `<form method="get">` na própria `DocumentsList`, sem JS de cliente, mesmo padrão de `/portal/calendario` (`?year=&month=`). Só ligado em `/portal/documentos` e `/portal/guias` - decisão de escopo, ver `decisions.md` D2.

### Estados loading/error

`src/app/portal/documentos/{loading,error}.tsx` e `src/app/portal/guias/{loading,error}.tsx` - não existia nenhum `loading.tsx`/`error.tsx` em rota nenhuma do Portal antes desta fase. `error.tsx` reaproveita um componente novo (`PortalErrorState`) que não renderiza o header/footer de marketing do `error.tsx` raiz - a sidebar do Portal continua montada por fora do boundary.
