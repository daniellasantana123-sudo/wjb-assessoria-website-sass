# Fase 3 - Documentos

## Objetivo original do prompt

Criar um módulo privado e auditável de documentos: listar, upload, download, categorias, busca, filtros, estados de loading/empty/error, storage privado, signed URLs com expiração, tenant check, permission check, limite de tamanho, allowlist de MIME, nome sanitizado, auditoria de upload/download, ponto de extensão para antimalware.

## O que já existia (não recriado)

O módulo de documentos já existia desde a SAAS FASE 2 (2026-09-16): tabela `documents`, bucket privado `documents` no Storage, upload/listagem/exclusão, RLS por tenant, URLs assinadas, limite de 20MB, auditoria de upload/exclusão. Ver `architecture.md` e `decisions.md` D1 para o detalhe completo do que já estava pronto.

## O que foi construído/endurecido nesta fase

1. **Download passou a ser auditado** - antes era um link direto pra uma URL assinada gerada com antecedência pra toda a lista (sem rastro de quem baixou o quê); agora passa por `GET /api/documents/[id]/download`, que gera a URL na hora (60s) e grava `document.downloaded` no `audit_log`.
2. **Allowlist de MIME** - só tipos com uso legítimo num escritório de contabilidade (PDF, imagem, planilha, Office, texto, XML).
3. **Nome de arquivo sanitizado** - `sanitizeFileName()`, antes de virar parte da chave do Storage.
4. **Busca por nome de arquivo** - `/portal/documentos` e `/portal/guias` ganharam campo de busca (`?q=`, GET, sem JS de cliente - mesmo padrão de `/portal/calendario`).
5. **Permissões finas wireadas de verdade** - `documents.read`/`documents.upload`/`documents.delete` (Fase 1, até então só scaffolding sem uso) passaram a ser checadas de fato em `uploadDocument`, `deleteDocument` e na nova rota de download, como defesa em profundidade junto da RLS.
6. **Ponto de extensão para antimalware** - `src/integrations/antivirus/`, Adapter Pattern (mesmo padrão de `email`/`whatsapp-business`), sempre "limpo" hoje porque nenhum provider real foi confirmado.
7. **`loading.tsx`/`error.tsx`** - não existiam em nenhuma rota do Portal; criados para `/portal/documentos` e `/portal/guias`.

Ver `architecture.md` para o detalhe técnico de cada item e `decisions.md` para o que ficou deliberadamente fora do escopo.
