# Segurança

> Status: **FASE 0**. Referência completa na seção 38 de [`../../Wjb-Website.md`](../../Wjb-Website.md).

## Aplicar (V1 em diante)

- CSP;
- HSTS;
- X-Content-Type-Options;
- Referrer Policy;
- Permissions Policy;
- validação server-side;
- rate limit;
- storage privado;
- signed URLs;
- secrets fora do código;
- logs;
- auditoria.

## Específico da V2

- RLS (Row Level Security) no Supabase/Postgres.

## Integrações (seção 35)

Toda integração externa deve usar API oficial, OAuth quando disponível, secret no servidor, escopos mínimos, rate limiting, timeout, retries, idempotência, webhooks assinados, logs e conformidade com LGPD.

## Pendências desta fase

- [ ] Nenhuma ação de segurança aplicável ainda — sem código implementado.
- [ ] Revisitar ao iniciar FASE 1 (headers e CSP no `next.config.ts`).
- [ ] Pentest e auditoria completos apenas na SAAS FASE 6.
