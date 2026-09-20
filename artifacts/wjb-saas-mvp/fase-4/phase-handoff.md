# Handoff - Fase 4 para a próxima fase

## O que está pronto

- Mapeamento por organization (`omie_client_mappings`), enum de status completo, RLS staff-write/tenant-read.
- Adapter Pattern para Omie.G-Click (`src/integrations/omie-gclick/`), com fallback no-op seguro sem credenciais.
- Sincronização do recurso "clientes" (`upsertClient`), acionada manualmente por staff em `/admin/empresas/[id]`.
- CTA "Ver no Portal Contábil" no Dashboard do cliente (`/portal`), condicional a status + link configurado.
- Permissões `integrations.read`/`integrations.manage` wireadas nas 3 Server Actions.
- Auditoria sanitizada (`integration.omie_mapping_updated`, `integration.omie_sync_attempted`, `integration.omie_disabled`/`_reactivated`).
- `docs/product/roadmap.md`/`docs/api/integrations.md` atualizados refletindo a reversão da decisão de 2026-09-16/09-20.
- Lint, typecheck, 116 testes e build - todos limpos.

## O que ficou deliberadamente fora desta fase

- "Tarefas"/"pré-tarefas" - sem documentação pública verificada nesta sessão. Ver `decisions.md` D2.
- Sincronização automática/periódica (cron/webhook) - só sob demanda, por clique de staff.
- Detecção real de `conflict` - o estado existe no enum/UI, mas nenhuma regra de negócio de "o que é um conflito" foi definida pela WJB ainda. Ver `decisions.md` D4.

## Pendências herdadas de fases anteriores (ainda não resolvidas)

- Credenciais do projeto Supabase real continuam ausentes - nada desta fase foi testado contra Storage/banco reais, só via mocks (mesma limitação desde a Fase 0).
- `.env.example`/`.github/workflows/` continuam ausentes (Fase 0) - `OMIE_APP_KEY`/`OMIE_APP_SECRET` deveriam entrar nessa lista quando ela for criada.

## Riscos

- **Adapter Omie não testado contra uma conta real** - implementado seguindo a convenção pública documentada, mas sem validação ao vivo (ver `decisions.md` D5). Antes de habilitar em produção, testar `upsertClient` contra uma conta Omie de sandbox/teste real e ajustar o parsing de resposta se necessário.
- **`external_portal_url` é preenchido manualmente por staff** - não há verificação automática de que o link aponta pro cliente certo no Omie.G-Click; um erro de digitação/cópia levaria o cliente a ver (ou tentar ver) os dados errados. Considerar validação cruzada quando/se uma API de consulta ficar disponível.
- **Nenhuma sincronização automática** - se o cadastro do tenant mudar na WJB (nome, CNPJ) depois de já sincronizado, o Omie só é atualizado na próxima vez que staff clicar "Sincronizar" manualmente.

## Próxima fase

Não definida - aguardando o próximo prompt numerado do usuário. Se uma fase futura expandir Omie.G-Click, os pontos de partida naturais são: (1) obter credenciais reais e validar o adapter contra uma conta de teste, (2) documentação oficial de "tarefas"/"pré-tarefas", (3) definir a regra de negócio de conflito.
