# Integrações

> Status: **SAAS FASE 5 iniciada** (2026-09-17) — E-mail (Resend) e WhatsApp (Meta WhatsApp Business Platform) implementados. **CRM e Armazenamento cancelados pelo usuário em 2026-09-18** (fora do escopo da FASE 5 — Armazenamento já coberto pelo Supabase Storage das FASES 1/2). Automação e Assinatura seguem na FASE 0. **Cobrança** não é mais nesta lista de "nenhuma decisão" - ver Omie.G-Click abaixo, implementado na Fase 4 do wjb-saas-mvp (2026-09-20). Referência completa nas seções 35–37 de [`../../Wjb-Website.md`](../../Wjb-Website.md).

## ERP/Fiscal - Omie.G-Click, mock funcional + real BLOCKED_BY_PROVIDER (Fase 6.5 - "mocks e contratos internos", 2026-09-20)

**Reverte a decisão de 2026-09-16** ("nenhuma integração de ERP/fiscal externo"), por instrução explícita do usuário na Fase 4 do wjb-saas-mvp - ver `artifacts/wjb-saas-mvp/fase-4/decisions.md` D1 para o histórico completo da contradição/reversão.

**Correção crítica confirmada numa auditoria técnica anterior** (Fase 6.5, `artifacts/wjb-saas-mvp/fase-6-5/`): a implementação da Fase 4 chamava a API do Omie ERP, não a da Omie.G-Click (produto separado, confirmado via documentação oficial). A implementação incorreta foi removida.

**Nesta fase** (mocks e contratos internos), a integração ganhou uma arquitetura completa de Ports & Adapters, documentada em [`../integrations/gclick/`](../integrations/gclick/):

- Contrato rico (`OmieGClickAdapter`: `clients.*`, `tasks.*`, `healthCheck()`, `getCapabilities()`) em `src/integrations/omie-gclick/types.ts` - modelado pelas necessidades da WJB, não pelo schema externo (ainda não confirmado).
- `MockGClickProvider` (`mock.provider.ts`) - **funcional, em memória, determinístico** - modo padrão (`GCLICK_MODE=mock` ou ausente). Nunca toca a rede, nunca persiste além do processo.
- `GClickHttpProvider` (`http.provider.ts`) - esqueleto real, todo método resolve `PROVIDER_NOT_CONFIGURED`. Ativado por `GCLICK_MODE=sandbox`/`production`, mas continua sempre bloqueado - nenhuma implementação real existe até a especificação técnica oficial (Postman) ser confirmada.
- `mappers/` (`client.mapper.ts`, `task.mapper.ts`, `error.mapper.ts`) - esqueletos, ponto único de tradução quando o schema real chegar.
- UI (`/admin/empresas/[id]`, `/admin/integracoes`) sempre mostra o modo ativo e nunca apresenta um resultado simulado como "Conectado" de verdade.

Mapeamento por organization (`omie_client_mappings`, `0017_omie_gclick_integration.sql`) - 1 linha por tenant, nunca direto a um usuário; validado como seguro (RLS herda a correção de `my_tenant_ids()` da Fase 5 - tenant/membership suspensos perdem acesso automaticamente). Cliente vê um CTA "Ver no Portal Contábil" no Portal (`/portal`) quando o status é `connected`/`synced`, apontando pra URL real do login do Portal Visão do Cliente (`https://visao.gclick.com.br/login`) - link externo em nova aba, nunca iframe, nunca SSO.

Resiliência: nenhum caminho crítico (login, documentos, Dashboard) chama o adapter Omie - só a ação explícita de staff. Em qualquer modo, o adapter nunca lança exceção, sempre resolve um resultado tipado.

Pendente do lado do usuário: contato direto com a Omie pra confirmar o modelo de credenciais/token da G-Click e acesso à documentação técnica completa (Postman) - ver `artifacts/wjb-saas-mvp/fase-6-5/omie-contact-checklist.md`.

## Supabase Auth - templates de e-mail (configuração no painel, 2026-09-29)

Os links de convite e de recuperação de senha precisam apontar para
`/auth/confirm` com `token_hash`, não para o `{{ .ConfirmationURL }}` padrão.
O padrão devolve a sessão depois do `#` da URL, que o servidor não enxerga, e o
convidado caía no login sem conseguir criar senha. Em **Authentication → Emails**:

- **Invite user**, assunto `Crie sua senha de acesso - WJB Assessoria Contábil`, link:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
- **Reset password**, assunto `Redefina sua senha - WJB Assessoria Contábil`, link:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

Em **Authentication → URL Configuration**, o **Site URL** precisa ser
`https://wjbassessoriacontabil.com.br`.

## E-mail (Resend) — implementado em 2026-09-17

Estrutura seguida à risca (ver seção abaixo): `src/integrations/email/{types.ts,provider.ts,resend.adapter.ts,templates.ts,index.ts}`. `getEmailAdapter()` cai num adapter no-op (só loga) sem `RESEND_API_KEY`/`EMAIL_FROM` configuradas — nunca quebra quem chamou.

Pontos de disparo:
- `notifyTicketOrMessageEvent` (`src/lib/notifications.ts`) — além da notificação in-app já existente, envia e-mail para cada destinatário com e-mail cadastrado (staff avisado de nova mensagem/ticket de cliente, e vice-versa).
- `POST /api/leads` (`src/app/api/leads/route.ts`) — avisa `siteConfig.contact.email` a cada novo lead do formulário (não para inscrições de newsletter, pra não gerar um e-mail por assinante).

**Configurado e funcionando em produção desde 2026-09-23.** Domínio verificado no Resend: `wjbassessoriacontabil.com.br` (raiz); `EMAIL_FROM` = `WJB Assessoria Contábil <nao-responda@wjbassessoriacontabil.com.br>`; `RESEND_API_KEY` configurada no painel da Hostinger. Entrega confirmada de ponta a ponta (lead de teste → `Delivered` no painel do Resend → caixa `contato@`).

O aviso de novo lead usa `replyTo` com o e-mail do próprio lead (2026-09-23) — responder a notificação fala direto com o cliente, em vez de voltar pro endereço técnico de envio.

**Armadilha que custou um ciclo de deploy**: `EMAIL_FROM` precisa ser um endereço **do domínio verificado**. Estava apontando pra um subdomínio (`envios.wjbassessoriacontabil.com.br`) que nunca foi cadastrado no Resend — o envio é recusado antes de virar registro no log de *Emails*, então o sintoma é "nenhum envio aparece", não "envio com erro". Se um dia migrar pra subdomínio (boa prática de isolamento de reputação), cadastre e verifique ele no Resend **antes** de mudar a variável.

## WhatsApp — só Click-to-Chat (decisão da WJB, 21/11/2026)

O site usa apenas links `wa.me` com mensagem pronta (`src/integrations/whatsapp`, número oficial +55 11 97614-6375). A integração com a WhatsApp Cloud API (`src/integrations/whatsapp-business`, aviso de novo lead por template, criada em 2026-09-18 e nunca ligada) foi **removida na Fase 9.1**, junto com as variáveis `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_LEAD_TEMPLATE_NAME`. O aviso de novo lead para a equipe agora é o e-mail pelo Resend (com os dados, para a caixa da WJB) mais um aviso interno no Admin, sem dado pessoal no texto (`notifyNewLead`).

## Padrão a seguir (Adapter Pattern, seção 37)

A aplicação não deve depender diretamente de um provider. Estrutura de referência:

```text
src/integrations/
├── email/
│   ├── types.ts
│   ├── provider.ts
│   ├── resend.adapter.ts
│   └── index.ts
└── antivirus/
    ├── types.ts
    ├── provider.ts
    └── index.ts
```

## Providers potenciais (seção 36) — nenhum confirmado ainda

| Categoria | Opções cogitadas |
|---|---|
| E-mail | Resend, Postmark, SendGrid, Amazon SES |
| WhatsApp | Só Click-to-Chat (decisão de 21/11/2026; Cloud API não usada) |
| CRM | HubSpot, Pipedrive, RD Station CRM (cancelado, ver abaixo) |
| Automação | n8n, Make, Zapier |
| Assinatura | Clicksign, ZapSign, DocuSign, Adobe Acrobat Sign |
| Agenda | Google Calendar, Microsoft Graph, Calendly |
| Billing | **Stripe** (escolhida em 21/11/2026; só modo de teste, ver `docs/wjb-ai/FASE-9-1-STRIPE-PAGAMENTOS-RELATORIO.md`) |
| Observabilidade | Sentry, Datadog, OpenTelemetry |
| ERP/Fiscal | ~~Omie, Conta Azul, Nibo, PlugNotas, NFE.io~~ (Omie.G-Click escolhido, ver acima) |

Somente implementar uma integração após confirmar API oficial, plano, credenciais e documentação do provider escolhido.

## Pendências desta fase

- [x] E-mail — Resend escolhido e implementado (2026-09-17); **conta, domínio verificado e env vars de produção concluídos em 2026-09-23**, com entrega confirmada de ponta a ponta. Nada pendente.
- [x] WhatsApp — Meta WhatsApp Business Platform (Cloud API) escolhido e implementado (2026-09-18). Falta a conta/número/template real do usuário (ver acima).
- [x] ~~CRM~~ — **cancelado pelo usuário em 2026-09-18**, fora do escopo da FASE 5.
- [x] ~~Armazenamento~~ — **removido em 2026-09-18**, já coberto pelo Supabase Storage (FASES 1/2).
- [~] ERP/Fiscal - Omie.G-Click escolhido (Fase 4); mock funcional (`GCLICK_MODE=mock`) desde a Fase 6.5 de mocks/contratos internos (2026-09-20) - real segue `BLOCKED_BY_PROVIDER`, faltando especificação técnica oficial (Postman) e credenciais reais. Ver `docs/integrations/gclick/`.
- [ ] Automação, Assinatura, Cobrança — nenhuma decisão de provider tomada ainda.
