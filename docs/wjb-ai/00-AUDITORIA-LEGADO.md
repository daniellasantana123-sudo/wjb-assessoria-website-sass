# 00 - Auditoria do legado (Fase Zero)

**Data:** 20/11/2026 · **Commit auditado:** `931560c5` (branch `main`, árvore limpa) · **Modo:** somente leitura.

**Como foi feita:** os 14 papéis do documento mestre foram executados **em sequência por um único agente** (Claude), não por subagentes paralelos. Não existe parecer independente de especialista fiscal, jurídico ou de segurança: as partes marcadas como "revisão humana" continuam pendentes.

## 1. Stack e versões

| Item | Achado | Evidência |
| --- | --- | --- |
| Framework | Next.js **16.3.7**, App Router, React, TypeScript, Tailwind v4 | `node_modules/next/package.json`, `src/app/` |
| Build | `next build --webpack` | `package.json` scripts |
| Banco/Auth/Storage | Supabase (Postgres + RLS + Auth + Storage), `@supabase/supabase-js` 2.116, `@supabase/ssr` | `src/lib/db/supabase/`, `supabase/migrations/` |
| Migrations | 23 arquivos SQL versionados (0001 a 0023), aplicados à mão pelo SQL Editor | `supabase/migrations/` |
| Validação | zod 4.5.4 | `package.json` |
| E-mail | Resend (adapter, no-op sem chave) | `src/integrations/email/` |
| Hospedagem | Hostinger, app Node.js único; deploy automático a cada `git push origin main` | CLAUDE.md, memória do projeto |
| Filas/workers | **Não existem.** Agendamento só por GitHub Actions chamando rota HTTP | `.github/workflows/lembretes-obrigacoes.yml`, `src/app/api/cron/` |
| Testes | Vitest 4.1 (47 arquivos, 348 testes) e Playwright (computador + celular) | `npm run test`, `playwright.config.ts` |
| CI | lint, typecheck, test, build | `.github/workflows/` (ci) |

## 2. Rotas e autenticação

| Área | Achado | Evidência |
| --- | --- | --- |
| Site público | grupo `(site)`, páginas estáticas | `src/app/(site)/` |
| Área do Cliente | `/portal/*` (calendário, documentos, guias, obrigações, relatórios, suporte, mensagens, notificações, usuários, segurança) | `src/app/portal/` |
| Admin | `/admin/*` (empresas, integrações, leads, logs, manual, mensagens, notificações, segurança, tickets, usuários) | `src/app/admin/` |
| Sessão | `getSession()` lê o perfil a cada request; conta suspensa = sem sessão | `src/lib/auth/dal.ts` |
| MFA | TOTP do Supabase, tela `/verificar-mfa` | `src/actions/mfa.ts` |
| Empresa ativa | cookie revalidado contra as empresas reais do usuário | `src/lib/tenant.ts:59` |
| Gate do SaaS | lido em runtime | `src/lib/saas-gate.ts`, `src/proxy.ts` |

## 3. Modelo de dados e multiempresa

- `tenants` (empresas), `tenant_members` (papel `owner`/`member`, status), `profiles` (`is_wjb_staff`, `staff_role` = `super_admin`/`contador`/`atendimento`, `status`).
- Isolamento por RLS com `my_tenant_ids()`, `is_staff()`, `is_super_admin()`, `is_tenant_owner()`, todas considerando suspensão (`0018`, `0021`).
- `0022` impede o usuário de se autopromover editando o próprio perfil.
- Tabelas de negócio: `documents`, `obligations` (+ origem externa G-Click, `0020`), `tickets`, `messages`, `notifications`, `leads`, `feature_flags`, `omie_client_mappings`, `audit_log`.
- **Risco de IDOR:** baixo nas rotas existentes - a empresa sai da sessão (`getActiveTenant`) e a RLS é a segunda barreira. Equipe (`is_staff()`) lê todas as empresas por desenho.

## 4. Integrações presentes no código

| Integração | Situação | Evidência |
| --- | --- | --- |
| Omie.G-Click | **Real, em produção** (clientes, tarefas, obrigações, responsáveis) | `src/integrations/omie-gclick/`, `src/actions/omie-gclick.ts` |
| E-mail (Resend) | Real | `src/integrations/email/` |
| WhatsApp | Links `wa.me` + adapter de envio de template (Cloud API) só de saída, no-op sem token; **não há webhook de entrada** | `src/integrations/whatsapp/`, `src/integrations/whatsapp-business/` |
| Antivírus de upload | Adapter | `src/integrations/antivirus/` |
| GTM/GA4 | Contêiner `GTM-TZKJ7CS8` com Consent Mode | `src/config/analytics.ts` |
| LLM / IA generativa | **Nenhuma.** A assistente Dani é fluxo determinístico | busca por `anthropic`/`openai` sem resultado |
| NFS-e / emissão fiscal | **Nenhum código.** Só textos comerciais ("Emissão assistida de NFS-e", "Monitor Fiscal WJB") | `src/config/plans.ts:311-317` |

## 5. Segurança existente

CSP, HSTS, X-Frame-Options e demais cabeçalhos (`next.config.mjs`); rate limit **em memória** de 5 req/min (`src/lib/security/rate-limit.ts`); `audit_log`; permissões finas em `src/lib/permissions/permissions.ts`; campo-armadilha e deduplicação nos formulários; segredos nas variáveis de ambiente do painel da Hostinger (**sem cofre/KMS**).

## 6. Achados

| Achado | Evidência | Severidade | Impacto | Ação | Responsável | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Não há cofre de segredos nem KMS | variáveis no painel da Hostinger | **Crítica para F4** | certificado A1 não pode ser guardado com segurança | escolher cofre (ex.: KMS de nuvem) antes de qualquer certificado | WJB + A09 | Aberto |
| Supabase no plano gratuito pausa por inatividade | ocorrido em 29/09 e 10/11 | **Alta** | atendimento 24h impossível; pedidos fiscais perdidos | plano pago | WJB | Aberto |
| Sem fila/worker; processo Node único | `package.json`, hospedagem | Alta para F3+ | retries e reconciliação precisam de execução fora do request | fila no Postgres (tabela + cron) ou worker dedicado | A06/A13 | Aberto |
| Rate limit só em memória | `rate-limit.ts` | Média | abuso de rotas caras (LLM) em escala | limitador persistente | A09 | Aberto |
| `NEXT_PUBLIC_*` congela no build | histórico do projeto | Média | flags novas precisam ler em runtime | já seguido em `src/lib/wjb-ai/config.ts` | A01 | Tratado |
| Nenhum papel `WJB_FISCAL_ADMIN` | `staff_role` enum | Média | quem aprova perfil fiscal fica indefinido | decisão da WJB | WJB | Aberto |
| Nenhuma documentação fiscal oficial conferida | - | **Crítica para F4** | XML/endpoint não podem ser escritos | A05 conferir e registrar versão | A05 + contador | Aberto |
| Sem provedor de LLM contratado nem análise LGPD | - | Alta para F2 | dados de clientes não podem ir a modelo externo | contrato, retenção, RIPD | WJB + A10 | Aberto |

## 7. Pontos de extensão escolhidos

Módulo isolado `src/lib/wjb-ai/` e rotas `src/app/api/wjb-ai/`, com permissões próprias (`src/lib/wjb-ai/permissions.ts`) e migração aditiva `0024`. Nenhum arquivo existente foi modificado no incremento F1.

## 8. Veredito

- **F1 a F3 (mock, sem dados reais): GO COM RESTRIÇÕES** - módulo desligado por padrão, sem migração aplicada sem aprovação.
- **F2 com LLM real: NO-GO** até contrato do provedor e análise LGPD.
- **F4 (homologação oficial): NO-GO** até cofre de certificados, documentação oficial conferida, credenciamento/procuração e plano pago do banco.
