# Arquitetura - Fase 4

## Banco de dados

`supabase/migrations/0017_omie_gclick_integration.sql`:

- `omie_integration_status` (enum): `not_connected | pending | connected | syncing | synced | conflict | error | disabled` - os 8 estados exatos do prompt, `create type`, mesma convenção de `obligation_status`/`ticket_status`/`account_status`.
- `omie_client_mappings`: `id, tenant_id (unique, FK tenants), external_client_id, external_portal_url, status, last_synced_at, last_error, updated_by, created_at, updated_at`.
  - `tenant_id` é `unique` - 1 mapeamento por empresa, nunca por usuário (exigência explícita do prompt: "nunca mapear Omie diretamente ao user").
  - RLS: leitura por staff ou membro do próprio tenant (`omie_mappings_select_staff_or_tenant_member`, mesmo padrão de `obligations_select_staff_or_tenant_member`); escrita só staff (`omie_mappings_write_staff_only`).

## Adapter Pattern

```text
src/integrations/omie-gclick/
├── types.ts       - OmieClientInput, OmieClientResult, OmieGClickAdapter
├── provider.ts     - getOmieGClickAdapter(): real se OMIE_APP_KEY/OMIE_APP_SECRET existirem, senão no-op
├── omie.adapter.ts - chamadas reais à API pública do Omie (clientes)
└── index.ts
```

Mesma estrutura de `email`/`whatsapp-business` (`docs/api/integrations.md`). `upsertClient()` é o único método hoje - ver `decisions.md` D2 pro porquê de "tarefas"/"pré-tarefas" não estarem aqui.

`omie.adapter.ts` chama `https://app.omie.com.br/api/v1/geral/clientes/` com o envelope documentado publicamente pelo Omie (`call`/`app_key`/`app_secret`/`param`, resposta sempre HTTP 200 mesmo em erro, com `faultstring`/`faultcode` no corpo indicando falha). `codigo_cliente_integracao` carrega `wjb-tenant-<tenant.id>` - é o campo que o próprio Omie expõe pra correlação com um sistema externo, evitando precisar já saber o `codigo_cliente_omie` de antemão. Timeout de 10s via `AbortController`; qualquer falha (rede, timeout, `faultstring`) é capturada e devolvida como `{ ok: false, error }`, nunca lançada.

**Ressalva registrada por transparência**: esta implementação segue a convenção pública documentada do Omie ao melhor conhecimento desta sessão, mas **não foi testada contra uma conta real** (nenhuma credencial disponível) - mesmo status do adapter Meta WhatsApp quando implementado em 2026-09-18. Validar contra a documentação atual (developer.omie.com.br) antes de habilitar em produção.

## Fluxo (Dashboard → BFF → Omie)

```text
Admin WJB (/admin/empresas/[id])
  -> Server Action (saveOmieMapping | syncOmieClient | setOmieMappingDisabled)
  -> requireStaffSession() + hasPermission("integrations.manage")   [Authorization]
  -> getOmieGClickAdapter().upsertClient(...)                        [Integration Service / Adapter]
  -> Omie API (ou no-op se sem credenciais)
  -> supabase.from("omie_client_mappings").upsert(...)               [atualiza status]
  -> supabase.from("audit_log").insert(...)                          [log sanitizado]
```

A "Server Action" É o BFF do diagrama do prompt - não existe (nem foi criada) uma rota REST paralela, mesma decisão D3 da Fase 1 ("Server Actions já cobrem o caso, não duplicar como REST"). O frontend (painel em `/admin/empresas/[id]`) nunca importa nem chama `src/integrations/omie-gclick` diretamente - só via essas 3 Server Actions, que rodam exclusivamente no servidor.

## Portal Contábil (CTA)

`src/components/portal/omie-portal-cta.tsx` - renderizado em `/portal` (dashboard do cliente). Um `<a target="_blank" rel="noopener noreferrer">` simples pro `external_portal_url` configurado por staff, visível só quando `status` é `connected` ou `synced`. Sem iframe (proibido pelo prompt), sem tentativa de SSO (proibido pelo prompt) - o cliente faz login no Omie.G-Click com as próprias credenciais lá, se existirem; a WJB só encurta o caminho até o link certo.

## Resiliência

- Nenhuma página crítica (login, `/portal`, `/portal/documentos`) importa o adapter Omie no caminho de renderização - só a Server Action de sincronização, disparada por clique explícito de staff. Uma falha do Omie nunca aparece nessas páginas.
- `getOmieMapping()` (leitura, usada no Dashboard do cliente pro CTA) só lê a tabela local `omie_client_mappings` - nunca chama a API do Omie ao vivo. Se o Omie estiver fora do ar, o Dashboard nem percebe.
- O adapter nunca lança exceção (toda chamada de rede está em `try/catch`, com timeout) - o pior caso é a Server Action devolver `{ error: "..." }`, tratado normalmente pela UI.

## Permissões

`src/lib/permissions/permissions.ts`:
- `integrations.read` - staff (via `BASE_STAFF_PERMISSIONS`) e tenant `owner`/`member` (só leitura, pro CTA aparecer).
- `integrations.manage` - só staff. Gate de defesa em profundidade nas 3 Server Actions, junto da RLS (`omie_mappings_write_staff_only`) que já bloqueia escrita de não-staff no banco.
