# 49 - Fase 10A: relatório de endurecimento (hardening)

**Data:** 21/11/2026 · Branch `wjb-ai/10a-hardening` (criada a partir de `wjb-ai/f2-solicitar-nfse`, `d9cb7557`) · **Só desenvolvimento e homologação.**

**Não foram feitos:** merge na `main`, deploy, migration na produção, cobrança real ou emissão fiscal. Nenhuma funcionalidade comercial nova.

**Coordenação:** dois agentes especializados trabalharam em paralelo, só lendo o código, e os achados deles foram conferidos no código antes de entrar aqui:
- **dados:** risco das migrations 0024-0033 para publicação;
- **segurança:** a revisão de autorização da auditoria 48, que serviu de base.

As correções e os testes foram feitos em sequência por um único agente.

## 1. Next.js e dependências (P0)
**Fonte oficial:** comunicado de segurança do Next.js de 03/11/2026 (nextjs.org/blog/november-2026-security-release). Ele corrige 7 problemas em 16.4.5:
- vazamento de cache entre empresas e entre usuários com `use cache`/`unstable_cache`;
- envenenamento do shell compartilhado em auto-hospedagem com `next start`;
- resposta trocada entre clientes por enquadramento de resposta comprimida atrás de proxy HTTP/1.1;
- cookie exposto em rotas Edge;
- desvio de bloqueio de SVG na otimização de imagens.

**Exposição real do projeto (conferida no código):**
- não usa `use cache`, `unstable_cache`, Cache Components, rotas Edge, `remotePatterns` nem `dangerouslyAllowSVG`;
- roda auto-hospedado com `next start` na Hostinger, atrás de um proxy (`hcdn`), o que mantém relevantes os itens de auto-hospedagem e de proxy.

A atualização é obrigatória de qualquer forma.

| Pacote | Antes | Depois | Motivo |
| --- | --- | --- | --- |
| `next` | 16.3.7 | **16.4.6** (a mais nova estável, de 09/11/2026; inclui as correções da 16.4.5) | comunicado acima e `npm audit` (crítica) |
| `eslint-config-next` | 16.3.7 | 16.4.6 | acompanha o `next` |
| `zod` | 4.5.4 | **4.6.7** | consumo de memória com coleções grandes (alta) |
| `sharp` (transitiva) | 0.35.4 | 0.35.5 | CVE na `librsvg` (alta) |
| `undici` (transitiva) | 8.11.2 | 8.13.1 | negação de serviço e SRI (alta) |
| `vite` (transitiva, só testes) | 8.2.2 | 8.3.8 | `launch-editor` (alta) |
| `vitest` e `@vitest/ui` (só testes) | 4.1.11 | **4.1.12** (mesma linha 4.x; sem saltar para a 5) | `@vitest/mocker` (moderada) |

`npm audit`: **antes**, 1 crítica, 4 altas e 10 moderadas; **depois**, **0**. Nenhuma versão principal foi alterada.

**Rollback:** voltar `package.json` e `package-lock.json` ao commit `d9cb7557` e rodar `npm ci`.

## 2. MFA, step-up e autorização no servidor (P0)
| Mudança | Onde | Efeito |
| --- | --- | --- |
| `getVerifiedSession()`: quem tem fator MFA e só passou pela senha (aal1) conta como **sem sessão** | `lib/auth/dal.ts`; usado em `/api/me`, `/api/me/organizations`, `/api/documents/[id]/download`, `/api/notifications/[id]/read`, `/admin/manual` e `/api/wjb-ai/fiscal/drafts/preview` | fecha o achado P2 da auditoria: com só a senha vazada não se baixa documento nem se lê dado pela API |
| **Step-up**: código do autenticador confirmado há no máximo **15 min** (`checkRecentStepUp`, regra pura `evaluateStepUp`, testada) | 7 ações fiscais (autorizar envio, aprovar perfil, registrar ou revogar autorização de emissão, configurar série da DPS, conceder ou revogar aprovador) e 2 comerciais (salvar ou aprovar plano, desconto do combo) | a permissão é conferida **antes**; quem não tem permissão recebe a mesma mensagem de sempre. Sem MFA: "ative a verificação em duas etapas"; vencido: "confirme de novo" |
| Reconfirmação `/verificar-mfa?reconfirmar=1&next=...` | página e ação de MFA; `lib/auth/safe-next.ts` | volta só para caminhos de `/admin` ou `/portal` da própria pessoa; destino externo é ignorado |
| Aviso nas páginas sensíveis | `components/auth/step-up-notice.tsx` em `/admin/comercial`, `/admin/nfse/perfis`, `/admin/nfse/permissoes` e `/admin/nfse/[id]` | mostra se a identidade está confirmada, ou o link para confirmar ou ativar |
| Chamadas internas de serviço (cron, webhook, fila) | sem MFA humano; continuam com `CRON_SECRET` em tempo constante e assinatura da Stripe | menor privilégio mantido |

**Limite assumido, com proposta (doc 52):** o step-up é verificado no **servidor da aplicação**. No **banco**, as políticas RLS e as funções de aprovação ainda não exigem `aal2`. Um super admin com a senha vazada chamando o PostgREST direto ainda conseguiria aprovar preço ou conceder aprovador. Fechar isso exige mudar funções e políticas de produção (`approve_fiscal_profile`, `grant_/revoke_fiscal_profile_approver`, políticas de `commercial_plans` e `commercial_settings`) e adaptar ~120 testes de banco. É mudança estrutural, proposta e não executada.

**Achado de teste:** o Supabase da homologação **aceita o mesmo código TOTP duas vezes** dentro da janela de 30 s. O provedor não impede a repetição de um código já usado; o risco é baixo, com HTTPS e janela curta. Registrado no doc 52.

**Não alterado (produção, decisão pendente):** o step-up nas ações de equipe que já estão em produção (convidar, mudar papel, suspender). Ligá-lo mudaria o uso atual de contas sem MFA. Proposto no doc 52.

## 3. Formulários públicos e notificações (P0)
| Mudança | Onde |
| --- | --- |
| Limites de tamanho em todos os campos dos schemas de lead, newsletter e popup (nome 120, e-mail 254, telefone 30, assunto 160, contexto 80, rastreamento 300 etc.) | `lib/validation/lead.ts` (valem no navegador e no servidor) |
| Corpo da requisição limitado a 16 mil caracteres antes de interpretar (413) | `/api/leads` |
| **Limite compartilhado** no banco (`rate_limit_hit`, migration **0034**): 5 por minuto e 30 por hora por IP, mais **teto global** de 600 por hora; chave guardada **só em hash** (nunca o IP); se o banco falhar, volta ao contador em memória, e o formulário nunca para | `lib/security/shared-rate-limit.ts` |
| Assunto do e-mail sem quebra de linha e com tamanho limitado; corpo e título do e-mail já escapados (auditoria 48) | `/api/leads`, `integrations/email/templates.ts` |
| Robôs: campo-armadilha (já existia) + limites. Sem CAPTCHA e sem rastreamento extra, de propósito | - |
| Cabeçalho `x-powered-by: Next.js` desligado | `next.config.mjs` |

**Escolha de infraestrutura do limite:** o próprio Supabase (uma tabela e uma função), sem serviço pago novo. O IP vem do primeiro `x-forwarded-for`, que o cliente pode forjar. Por isso há o teto global. O cabeçalho confiável do proxy da Hostinger precisa ser confirmado (doc 52).

**Bug achado e corrigido durante o teste:** na reserva em memória, a conversão "30 por hora para por minuto" dava 1 por minuto e barraria o 2º envio legítimo. Agora a reserva usa o limite da regra. Há teste de regressão.

## 4. Migrations
- **0034** (nova, aditiva, só homologação):
  - tabela `rate_limit_buckets` (RLS sem política) e a função `rate_limit_hit`, que só o servidor executa;
  - 5 índices em `tenant_id` usados pela RLS, que faltavam (achado do agente de dados).
  - Testes T120-T128; rollback `21_rollback_0034.sql`.
- **Suspeita do agente sobre a exclusão de empresa (LGPD), não confirmada:** testei apagar uma empresa com número de DPS alocado, assinatura e consumo, e a exclusão funcionou. A combinação com a trilha de certificado não foi testada (pendência).
- A análise completa de publicação das migrations 0024-0034 está no doc 51.

## 5. Revisão de cache, cabeçalhos e segredos
- Nenhum uso de cache de dados do Next (`use cache`, `unstable_cache`, `revalidate` em dado autenticado). As páginas do Portal e do Admin são dinâmicas (`ƒ` no build).
- Cabeçalhos de segurança existentes conferidos na produção: CSP, HSTS e outros. A CSP mantém `'unsafe-inline'`, conhecido desde a Fase 7.
- Varredura de segredos no diff: nenhum. Os segredos TOTP dos usuários fictícios ficam só em `.env.homolog.users.local` (fora do Git, permissão 600).

## 6. Qualidade
- Login dos E2E num helper só (`src/tests/e2e/helpers/login.ts`), antes copiado em 7 specs. Ele completa o MFA quando o usuário fictício tem TOTP.
- Os usuários fictícios SUPERADMIN e CONTADOR da homologação agora têm MFA (`08-mfa-usuarios.mjs`), para testar de verdade.

## 7. Produção (somente leitura, sem credencial)
- Site, `/login` e `/planos` respondem 200; `/emissao-de-notas` dá 404 (interruptor desligado).
- O DNS do projeto Supabase de produção resolve, e o Auth responde (401 sem chave): **o projeto não está pausado**.
- **Não verificado** (sem acesso de leitura autorizado ao banco): saúde do banco, integridade dos dados, histórico real das migrations, backups e resposta do suporte sobre o incidente de 20/11.
