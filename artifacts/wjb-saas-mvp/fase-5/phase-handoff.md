# Handoff - Fase 5 para a próxima fase

## O que está pronto

- Empresas: buscar, editar, suspender/reativar (com fix real de RLS por trás).
- Usuários: trocar papel/revogar acesso/reenviar convite pra membros de empresa; reenviar convite pra staff.
- Omie.G-Click: visão entre empresas (`/admin/integracoes`), testar conexão.
- Feature flags: `omie_gclick`/`documents`/`notifications`, cada uma com ponto de checagem real.
- Auditoria: filtros por empresa/usuário/ação/período.
- Testes de privilege escalation cobrindo as ações mais sensíveis desta fase.
- Lint, typecheck, 147 testes e build - todos limpos.

## O que ficou deliberadamente fora desta fase

- Feature flags pra `obligations`/`tickets`/`messages` ("demais features do MVP") - sem ponto de checagem real definido, seria um toggle decorativo. Ver `decisions.md` D2.
- Detecção automática de conflito Omie (`status: "conflict"`) - segue sem lógica que dispara esse estado (pendência herdada da Fase 4).
- "Tarefas"/"pré-tarefas" do Omie - segue sem documentação pública verificada (pendência herdada da Fase 4).
- Papel `wjb_admin` separado - tratado como `super_admin` já existente. Ver `decisions.md` D5.

## Pendências herdadas de fases anteriores (ainda não resolvidas)

- Credenciais do projeto Supabase real continuam ausentes - nada desta fase foi testado contra banco real, só via mocks.
- `.env.example`/`.github/workflows/` continuam ausentes (Fase 0).
- Credenciais Omie (`OMIE_APP_KEY`/`OMIE_APP_SECRET`) continuam ausentes - `testConnection` nunca foi chamado contra a API real.

## Riscos

- **`resendMemberInvite`/`resendStaffInvite` não testados contra o caso real "convite já aceito"** - sem uma conta Supabase real, não dá pra confirmar o comportamento exato do `inviteUserByEmail` nesse cenário. Ver `decisions.md` D7.
- **Suspender uma empresa é imediato e sem aviso prévio ao cliente** - a próxima requisição de qualquer membro já vem vazia (RLS). Não há e-mail/notificação avisando a suspensão - se isso for necessário, precisa de um disparo explícito (reaproveitando `notifyTicketOrMessageEvent`/`getEmailAdapter`, ainda não conectado a este evento).
- **Busca de empresas (`?q=`) sanitiza `,`/`(`/`)` do termo antes de montar o filtro `or` do PostgREST** - caracteres além desses (ex.: `%`, `_`) não são escapados; um CNPJ com esses caracteres literais na busca teria comportamento de `ilike` levemente diferente do esperado. Risco baixo (ferramenta interna, staff-only).

## Próxima fase

Não definida - aguardando o próximo prompt numerado do usuário.
