# Fase 2 - Auth, onboarding e Dashboard

## Objetivo original do prompt

Entregar a jornada completa (convite → cadastro → verificação → login → organização ativa → onboarding → Dashboard), consolidar auth (login/logout/reset/verificação/sessão expirada/revogação/usuário suspenso), preparar MFA, organization switcher e um Dashboard MVP.

## O que já existia (não recriado)

- Login/logout/esqueci senha/reset de senha (`src/actions/auth.ts`).
- Verificação de e-mail - cumprida pelo próprio link de convite/recuperação do Supabase Auth (não há autocadastro).
- Dashboard real em `/portal` - empresa ativa, cards de obrigações/documentos/guias/pessoas, gráfico mensal, próximas obrigações. Validado em produção desde 2026-09-16.
- "status Omie" no dashboard - descartado, mesma decisão das Fases 0 e 1.

Ver `decisions.md` D1 para o detalhe de cada item.

## O que foi construído nesta fase (3 decisões do usuário, ver `decisions.md` D2-D4)

1. **MFA (TOTP) - "preparar a estrutura", sem exigir de ninguém.** Enroll/challenge/unenroll via `supabase.auth.mfa.*` (API nativa, sem tabela própria). `requireSession()` agora checa o AAL da sessão e redireciona pra `/verificar-mfa` quando a pessoa tem um fator verificado mas ainda não completou o desafio - isso é zero-efeito pra quem nunca ativou (todo mundo hoje).
2. **Organization switcher - construído mesmo sem caso de uso real hoje.** `getActiveTenant()` (cookie + revalidação server-side contra `tenant_members` de verdade) substitui `getMyPrimaryTenant()` (removida) em todas as páginas do Portal. UI: `<select>` na sidebar, só aparece com 2+ empresas.
3. **Suspensão de conta + vínculo, com bloqueio de sessão.** Duas colunas novas (`profiles.status`, `tenant_members.status`, migration `0016`), checadas em `getSession()`/`getTenantRole()` (bloqueio imediato e garantido pelo próprio projeto) + chamada best-effort a `supabase.auth.admin.updateUserById(..., { ban_duration })` (camada extra usando o mecanismo nativo do Supabase, sem ser o mecanismo do qual o bloqueio depende).

## Arquivos criados/alterados nesta fase

Ver `architecture.md` para a lista completa com explicação de cada um.

## Fora de escopo desta fase (documentado, não esquecido)

Cards "Notificações"/"Suporte" como atalho dedicado no Dashboard (`/portal`) - já são alcançáveis em 1 clique pela sidebar, com contador de não lidas próprio. Ver `decisions.md` D5.
