# Handoff - Fase 2 para a próxima fase

## O que está pronto

- MFA (TOTP) funcional de ponta a ponta para quem optar por ativar - enrollment, challenge no login, unenroll. Não obrigatório pra ninguém.
- Organization switcher funcional de ponta a ponta - cookie validado sempre contra o banco, todas as páginas do Portal migradas.
- Suspensão de conta (bloqueia login) e de vínculo com empresa (bloqueia só aquela empresa), com UI em `/admin/usuarios` e `/admin/empresas/[id]`.
- Lint, typecheck, 80 testes e build - todos limpos.

## O que ficou deliberadamente fora desta fase

- Cards "Notificações"/"Suporte" redundantes no Dashboard - já alcançáveis pela sidebar. Ver `decisions.md` D5.
- Migration de dados: usuários/vínculos existentes recebem `status = 'active'` por padrão (`default 'active'` na migration) - nenhuma ação manual necessária quando a migration for aplicada num banco com dados reais.

## Pendências herdadas de fases anteriores (ainda não resolvidas)

- Credenciais do projeto Supabase real (`wjb-website-app`) continuam ausentes em todos os ambientes acessíveis - nada desta fase pôde ser testado contra banco real, só via mocks. Recomenda-se testar manualmente MFA (enroll com app autenticador de verdade), o switcher (com 2 empresas reais) e a suspensão assim que reconectado.
- `.env.example` e `.github/workflows/` continuam ausentes (Fase 0).

## Riscos

- A migration `0016` precisa ser aplicada antes de qualquer deploy que use este código - `getSession()`/`getTenantRole()` agora fazem `select ... status` e quebrariam contra um banco sem essa coluna. Como nenhum banco real está conectado ainda (ver acima), isso não é um risco imediato, mas é uma dependência de ordem a lembrar quando o Supabase for reconectado.
- O mecanismo de `ban_duration` não tem confirmação prática de timing de propagação (ver `decisions.md` D4) - tratado como best-effort, não como garantia.

## Próxima fase

Não definida - aguardando o próximo prompt numerado do usuário.
