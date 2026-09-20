# Arquitetura (pós-correção) - Omie.G-Click, Fase 6.5

## O que mudou

```text
src/integrations/omie-gclick/
├── types.ts       - contrato OmieGClickAdapter (inalterado na forma, comentários corrigidos)
├── provider.ts     - reescrito: getOmieGClickAdapter() sempre no-op; isOmieConfigured() sempre false
├── constants.ts    - NOVO: GCLICK_CLIENT_PORTAL_URL (URL real e fixa do Portal Visão do Cliente)
├── omie.adapter.ts - REMOVIDO (chamava a API do Omie ERP por engano)
└── index.ts        - export de GCLICK_CLIENT_PORTAL_URL adicionado
```

Nada mais em `src/actions/omie-gclick.ts`, `src/lib/omie-gclick.ts`, `supabase/migrations/0017_omie_gclick_integration.sql`/`0018_admin_console.sql`, feature flag, permissions, ou testes de action precisou mudar de estrutura - só o adapter concreto e a UI dependente dele.

## Fluxo corrigido

```text
Portal/Admin (staff)
  -> Server Action (saveOmieMapping | syncOmieClient | setOmieMappingDisabled | testOmieConnection)
  -> requireStaffSession() + hasPermission("integrations.manage")   [Authorization - inalterado]
  -> getOmieGClickAdapter()                                          [sempre devolve o adapter no-op]
  -> { ok: false, error: "blocked-by-provider" }                    [nunca chama rede]
  -> supabase.from("omie_client_mappings").upsert(...)               [status vira "error", sanitizado]
  -> supabase.from("audit_log").insert(...)                          [log sanitizado, sem credencial]
```

O "Integration Service"/BFF do diagrama do prompt continua sendo a própria Server Action (decisão D3 da Fase 4, reafirmada) - nada mudou nessa camada, só o que o adapter faz quando é chamado.

## Portal Contábil (CTA) - corrigido

```text
getOmieMapping(tenantId)
  -> mapping.status === "connected" | "synced"?
       -> mapping.externalPortalUrl || GCLICK_CLIENT_PORTAL_URL
       -> <a target="_blank" rel="noopener noreferrer">
```

`GCLICK_CLIENT_PORTAL_URL = "https://visao.gclick.com.br/login"` - confirmado via documentação oficial nesta fase (não é um valor inventado).

## Resiliência (reforçada, não só preservada)

Antes, a resiliência dependia de: timeout de 10s + try/catch dentro de `omie.adapter.ts`. Agora, como o adapter nunca chama rede nenhuma, não existe mais NENHUM modo de falha de rede possível - a única coisa que pode acontecer é a resposta constante `{ok:false, error:"blocked-by-provider"}`, resolvida de forma síncrona/imediata. Login, Dashboard, Documentos, Notificações e Admin continuam nunca dependendo deste módulo (confirmado por leitura de código: nenhum desses caminhos importa `src/integrations/omie-gclick`).

## Segurança (reforçada)

Como não há mais nenhuma leitura de `OMIE_APP_KEY`/`OMIE_APP_SECRET`, não há mais nenhuma variável de ambiente sensível associada a esta integração até que o modelo real seja confirmado - elimina de vez a possibilidade de alguém configurar essas chaves (achando que ativam a G-Click) e acidentalmente autenticar contra o Omie ERP da própria WJB com um efeito colateral real e não intencional (criar/alterar um cliente no sistema errado).
