# Workflow da Fase 3

## Processo desta fase

```mermaid
flowchart TD
    A[Entrada: prompt 04_FASE_3_DOCUMENTOS.md] --> B[Ler artifacts das Fases 0-2]
    B --> C{Auditar modulo de documentos existente}
    C --> D[Achado: tabela, bucket, upload, listagem, RLS ja existem desde SAAS FASE 2]
    D --> E[Achado real: download nao e auditado - URL gerada em lote pra lista inteira]
    E --> F[Achado real: sem allowlist de MIME, sem sanitizar nome, sem busca]
    F --> G[Achado real: permissoes finas da Fase 1 nunca foram usadas em lugar nenhum]
    G --> H[Redesenhar download: rota dedicada, URL sob demanda, auditoria]
    H --> I[Adicionar allowlist de MIME + sanitizacao de nome em uploadDocument]
    I --> J[Criar src/integrations/antivirus - Adapter Pattern, no-op]
    J --> K[Wire hasPermission em upload/delete/download]
    K --> L[Adicionar busca por nome em documentos e guias]
    L --> M[Criar loading.tsx/error.tsx do Portal]
    M --> N[Escrever testes]
    N --> O[Rodar lint, typecheck, test, build]
    O --> P{Tudo limpo?}
    P -->|Nao| N
    P -->|Sim| Q[Escrever architecture.md, decisions.md, checklist.md, test-report.md]
    Q --> R[Escrever phase-handoff.md e atualizar STATUS.md]
```

## Fluxo de dados - Download auditado

```mermaid
sequenceDiagram
    participant U as Usuario
    participant List as DocumentsList
    participant Route as GET /api/documents/[id]/download
    participant DB as Postgres (RLS)
    participant Storage as Supabase Storage
    participant Audit as audit_log

    U->>List: clica no nome do arquivo
    List->>Route: GET /api/documents/{id}/download
    Route->>DB: select tenant_id, storage_path where id = {id}
    Note over DB: RLS ja filtra - documento de outra empresa nunca retorna
    alt documento nao encontrado
        DB-->>Route: null
        Route-->>U: 404
    else documento encontrado
        DB-->>Route: tenant_id, storage_path, file_name
        Route->>Route: hasPermission(session, "documents.read", tenantRole)
        alt sem permissao
            Route-->>U: 403
        else com permissao
            Route->>Storage: createSignedUrl(path, 60s)
            Storage-->>Route: URL assinada
            Route->>Audit: insert document.downloaded
            Route-->>U: 307 redirect pra URL assinada
        end
    end
```

## Fluxo de dados - Upload endurecido

```mermaid
flowchart TD
    A[uploadDocument recebe FormData] --> B{hasPermission documents.upload?}
    B -->|Nao| Z1[Erro: sem permissao]
    B -->|Sim| C{Arquivo selecionado?}
    C -->|Nao| Z2[Erro: selecione um arquivo]
    C -->|Sim| D{Tamanho > 20MB?}
    D -->|Sim| Z3[Erro: arquivo maior que 20MB]
    D -->|Nao| E{MIME esta na allowlist?}
    E -->|Nao| Z4[Erro: tipo nao permitido]
    E -->|Sim| F[getAntivirusAdapter.scan]
    F --> G{clean?}
    G -->|Nao| Z5[Erro generico - nao expoe detalhe do scan]
    G -->|Sim| H[sanitizeFileName]
    H --> I[Upload no Storage]
    I --> J[Insert em documents]
    J --> K{Insert falhou?}
    K -->|Sim| L[Remove do Storage - nao deixa orfao]
    K -->|Nao| M[audit_log: document.uploaded]
    M --> N[revalidatePath]
```

## Dependências

- `src/lib/permissions/permissions.ts` (Fase 1) - `documents.delete` adicionado ao `Permission` union e a `STAFF_PERMISSIONS`.
- `src/integrations/antivirus/` - novo, mesmo padrão de `email`/`whatsapp-business`.
- Nenhuma dependência npm nova.

## Testes

- `src/tests/unit/documents.test.ts` - 8 testes (`isAllowedMimeType`, `sanitizeFileName`).
- `src/tests/integration/documents-download-api.test.ts` - 4 testes (401, 404 por RLS, sucesso com auditoria, staff sem checagem de tenant).
- `src/tests/integration/documents-upload-action.test.ts` - 7 testes (permissão, tamanho, MIME, antimalware, sanitização, sucesso, rollback de órfão).

## Saídas

- 1 rota nova (`GET /api/documents/[id]/download`).
- 1 integração nova (`src/integrations/antivirus`).
- `src/lib/documents.ts` reescrito (sem geração de URL em lote; busca; allowlist; sanitização).
- `src/actions/documents.ts` endurecido (permissões, MIME, antimalware, nome sanitizado).
- 4 arquivos novos de `loading.tsx`/`error.tsx`.
- 19 testes novos.

## Critério para avançar

Lint/typecheck/test/build limpos (ver `test-report.md`), checklist completo - fase concluída.
