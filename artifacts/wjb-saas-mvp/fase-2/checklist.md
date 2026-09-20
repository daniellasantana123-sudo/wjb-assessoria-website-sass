# Checklist de aceite - Fase 2

- [x] Convite até Dashboard funciona - fluxo já existente (Fase 0), sem mudanças; verificado que continua íntegro (build/testes limpos).
- [x] Login/logout/reset - já existentes, mais o passo opcional de MFA quando ativado (novo).
- [x] Organization context - `getActiveTenant()`, cookie validado server-side, nunca confiado sozinho.
- [x] Multi-organization - switcher construído e funcional (`OrganizationSwitcher`), mesmo sem usuário real com 2+ empresas hoje.
- [x] Dashboard baseado em permissions - o Dashboard já existente não precisou de mudança de permissão (mostra dados da empresa ativa, que já respeita RLS); os cards novos de Segurança em `/admin`/`/portal` aparecem pra qualquer sessão autenticada (não há permissão restrita a checar aqui, é uma configuração pessoal de conta).
- [x] Mobile e acessibilidade - reaproveita componentes já responsivos/acessíveis do projeto (`Select`, `Input`, `Label`, `Button`, `Badge`); nenhum componente novo de layout complexo foi criado.
- [x] Zero vazamento cross-tenant - `switchActiveTenant`/`getActiveTenant` sempre revalidam contra `tenant_members` reais; `suspendMember` sempre escopado por `tenant_id` + `profile_id`.

## Itens adicionais do prompt

- [x] MFA preparado (não obrigatório) - TOTP, enroll/challenge/unenroll, AAL checado no `requireSession()`.
- [x] Usuário suspenso - `profiles.status`, bloqueia login inteiro.
- [x] Revogação de sessão - best-effort via `ban_duration`, mecanismo real é a checagem de `status` (ver `decisions.md` D4).
- [x] Estados (loading/empty/error/permission_denied/integration_not_configured) - não foi necessário criar estados novos; os fluxos novos (MFA, switcher, suspensão) reaproveitam os padrões de erro/sucesso já usados em `useActionState` no resto do projeto (ex.: `LoginForm`).

## Verificação técnica

- [x] Lint limpo.
- [x] Typecheck limpo.
- [x] 80 testes passando (24 novos desta fase).
- [x] Build limpo, incluindo as 3 rotas novas desta fase (`/verificar-mfa`, `/portal/seguranca`, `/admin/seguranca`).
