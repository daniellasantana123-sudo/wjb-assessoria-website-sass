# Checklist de aceite - Fase 4

- [x] Mapping por organization - `omie_client_mappings`, `tenant_id` único, nunca por usuário.
- [x] Token server-side - `OMIE_APP_KEY`/`OMIE_APP_SECRET` só em variável de ambiente, adapter roda só em `server-only`.
- [x] Adapter - `src/integrations/omie-gclick/` (Adapter Pattern, mesmo padrão de `email`/`whatsapp-business`).
- [x] Sem SSO inventado - CTA é um link simples, cliente autentica com as próprias credenciais no Omie.G-Click.
- [x] Sem iframe não autorizado - `<a target="_blank">`, nenhum `<iframe>` foi criado.
- [x] Sem endpoint privado - só o recurso "clientes", documentado publicamente; "tarefas"/"pré-tarefas" deliberadamente não implementadas (ver `decisions.md` D2).
- [x] Degraded state - adapter no-op sem credenciais, nunca lança exceção; nenhum caminho crítico (login/documentos/Dashboard) depende do adapter.
- [x] Logs sanitizados - `audit_log` grava só `{ ok, error }`, nunca `app_key`/`app_secret`/resposta bruta.
- [x] Permissions validadas - `integrations.manage` (staff-only) checado nas 3 Server Actions, além da RLS (`omie_mappings_write_staff_only`).

## Itens adicionais do prompt

- [x] Enum de status completo (8 estados) - implementado no banco e na UI (`OmieStatusBadge`).
- [x] Portal Contábil - CTA em `/portal`, condicional a `status` e link configurado.
- [x] Fluxo Dashboard → BFF → Adapter → Omie - Server Actions cumprindo o papel do BFF (ver `decisions.md` D3).
- [x] Resiliência - Omie indisponível não afeta login/documentos/Dashboard (nenhum desses caminhos chama o adapter).

## Verificação técnica

- [x] Lint limpo.
- [x] Typecheck limpo.
- [x] 116 testes passando (17 novos desta fase: 5 unit adapter + 11 integration actions + 1 permissions).
- [x] Build limpo (nenhuma rota REST nova - Server Actions apenas).
