# Handoff - Fase 0 para a próxima fase

## O que está pronto

- Auditoria completa da plataforma SaaS atual (auth, tenant, RBAC, rotas, banco, integrações, testes, CI, secrets) - ver `architecture.md`.
- Contradição de escopo sobre Omie/G-Click resolvida com o usuário - descartado, ver `decisions.md` D1.
- Lint, typecheck, testes unitários e build confirmados limpos - ver `test-report.md`.
- Repositório organizado (arquivos soltos de sessão removidos/ignorados) - ver `decisions.md` D4.

## O que está pendente (não é bloqueio para começar a próxima fase, mas afeta o que dá pra testar de ponta a ponta)

- Credenciais do projeto Supabase real (`wjb-website-app`) não estão configuradas em nenhum ambiente acessível hoje - qualquer trabalho que precise rodar contra banco real (RLS, migrations novas, E2E do SaaS) fica bloqueado até isso ser resolvido pelo usuário.
- `.env.example` e `.github/workflows/` ausentes - podem ser recriados a qualquer momento, não dependem de nenhuma outra decisão.

## Riscos conhecidos

- `src/types/database.ts` mantido manualmente - risco de dessincronia silenciosa com o schema real se uma migration nova for aplicada sem atualizar esse arquivo também.
- Rate limiting em memória (`src/lib/security/rate-limit.ts`) - não sobrevive a cold start em ambiente serverless; hoje a Hostinger roda `next start` como processo persistente, então isso não é um problema imediato, mas vale registrar caso o hosting mude no futuro.

## Próxima fase

Não definida neste prompt (o template indica que fases futuras virão numeradas, ex. `02_...`). Ver `implementation-plan.md` para candidatos levantados por esta auditoria, sem prioridade definida.
