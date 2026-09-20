# Integrações

> Status: **SAAS FASE 5 iniciada** (2026-09-17) — E-mail (Resend) e WhatsApp (Meta WhatsApp Business Platform) implementados. **CRM e Armazenamento cancelados pelo usuário em 2026-09-18** (fora do escopo da FASE 5 — Armazenamento já coberto pelo Supabase Storage das FASES 1/2). Automação e Assinatura seguem na FASE 0. **Cobrança** não é mais nesta lista de "nenhuma decisão" - ver Omie.G-Click abaixo, implementado na Fase 4 do wjb-saas-mvp (2026-09-20). Referência completa nas seções 35–37 de [`../../Wjb-Website.md`](../../Wjb-Website.md).

## ERP/Fiscal - Omie.G-Click, BLOCKED_BY_PROVIDER desde 2026-09-20 (Fase 6.5)

**Reverte a decisão de 2026-09-16** ("nenhuma integração de ERP/fiscal externo"), por instrução explícita do usuário na Fase 4 do wjb-saas-mvp - ver `artifacts/wjb-saas-mvp/fase-4/decisions.md` D1 para o histórico completo da contradição/reversão.

**Correção crítica na Fase 6.5** (auditoria técnica, 2026-09-20): a implementação da Fase 4 chamava `https://app.omie.com.br/api/v1/geral/clientes/` com o envelope `call`/`app_key`/`app_secret`/`param` (`IncluirCliente`/`AlterarCliente`/`ListarClientes`) - **essa é a API do Omie ERP, não a da Omie.G-Click**. A documentação oficial (ajuda.omie.com.br, artigos "Omie.G-Click: API" e "Como funcionam as Integrações da G-Click", lidos nesta fase) confirma que a Omie.G-Click API é um produto separado, com autenticação própria via um endpoint de "Gerar credenciais" que devolve um Token exigido em todos os demais endpoints - não o par `app_key`/`app_secret` reenviado a cada requisição. A implementação incorreta foi **removida** (`src/integrations/omie-gclick/omie.adapter.ts` deletado) - `getOmieGClickAdapter()` agora sempre devolve o adapter no-op, resolvendo com `{ok:false, error:"blocked-by-provider"}`, nunca chamando rede nenhuma. Ver `artifacts/wjb-saas-mvp/fase-6-5/audit-report.md`/`api-validation.md` para o diagnóstico completo.

Estrutura: `src/integrations/omie-gclick/{types.ts,provider.ts,constants.ts,index.ts}` - mesmo Adapter Pattern de e-mail/WhatsApp (interface preservada; só a implementação de rede foi removida).

Endpoints reais confirmados na documentação oficial (sem schema técnico completo - só o Postman oficial tem isso, e é renderizado via JavaScript, inacessível nesta sessão): clientes (criar/alterar/listar/buscar/buscar clienteId), tarefas (listar tarefas, criar pré-tarefa) - e 2 endpoints explicitamente `partner_only` ("Responder atividade", "Criar pré-tarefa com tag"). Nenhum desses foi implementado - reativar exige a especificação técnica completa (contato direto com a Omie, ver `omie-contact-checklist.md`) e credenciais reais pra validar.

Mapeamento por organization (`omie_client_mappings`, `0017_omie_gclick_integration.sql`) - 1 linha por tenant, nunca direto a um usuário; validado como seguro na Fase 6.5 (RLS já herda a correção de `my_tenant_ids()` da Fase 5 - tenant/membership suspensos perdem acesso automaticamente). Staff configura manualmente (`external_client_id`, `external_portal_url` opcional) em `/admin/empresas/[id]`. Cliente vê um CTA "Ver no Portal Contábil" no Portal (`/portal`) quando o status é `connected`/`synced` - agora aponta pra URL real do login do Portal Visão do Cliente (`https://visao.gclick.com.br/login`, confirmada via documentação oficial na Fase 6.5) quando staff não configurou um link próprio - link externo em nova aba, nunca iframe, nunca SSO.

Resiliência: nenhum caminho crítico (login, documentos, Dashboard) chama o adapter Omie - só a ação explícita de staff, que agora sempre resolve com erro sanitizado sem nenhuma chamada de rede.

Pendente do lado do usuário: contato direto com a Omie pra confirmar o modelo de credenciais/token da G-Click e acesso à documentação técnica completa (Postman) - ver `artifacts/wjb-saas-mvp/fase-6-5/omie-contact-checklist.md`.

## E-mail (Resend) — implementado em 2026-09-17

Estrutura seguida à risca (ver seção abaixo): `src/integrations/email/{types.ts,provider.ts,resend.adapter.ts,templates.ts,index.ts}`. `getEmailAdapter()` cai num adapter no-op (só loga) sem `RESEND_API_KEY`/`EMAIL_FROM` configuradas — nunca quebra quem chamou.

Pontos de disparo:
- `notifyTicketOrMessageEvent` (`src/lib/notifications.ts`) — além da notificação in-app já existente, envia e-mail para cada destinatário com e-mail cadastrado (staff avisado de nova mensagem/ticket de cliente, e vice-versa).
- `POST /api/leads` (`src/app/api/leads/route.ts`) — avisa `siteConfig.contact.email` a cada novo lead do formulário (não para inscrições de newsletter, pra não gerar um e-mail por assinante).

Pendente do lado do usuário: criar a conta Resend, gerar a API key e verificar o domínio de envio (`wjbassessoriacontabil.com.br` ou um subdomínio como `mail.wjbassessoriacontabil.com.br`) antes de preencher `RESEND_API_KEY`/`EMAIL_FROM` em produção — sem isso, os e-mails continuam caindo no adapter no-op (não é um bug, é o fallback esperado).

## WhatsApp (Meta WhatsApp Business Platform) — implementado em 2026-09-18

Provider escolhido: **Cloud API da própria Meta, direto**, não um BSP terceiro — já é a API oficial (seção 35), sem custo/latência de middleman e sem SDK novo (`fetch` puro contra o Graph API, mesma filosofia de "adicionar dependências apenas quando necessário"). Estrutura: `src/integrations/whatsapp-business/{types.ts,provider.ts,meta.adapter.ts,index.ts}` — pasta separada de `src/integrations/whatsapp/` (que já existia desde 2026-08-30 só pra montar link `wa.me` com mensagem pré-preenchida nos CTAs do site; continua existindo, propósito diferente).

**Só `sendTemplate`, nunca texto livre**: a Cloud API só aceita mensagem de texto livre dentro de uma janela de 24h aberta pelo cliente. Uma notificação iniciada pela WJB (ex.: aviso de novo lead) é sempre "business-initiated" e exige um **template (HSM) pré-aprovado pela Meta no WhatsApp Manager** — não dá pra simular isso sem a conta real, então o adapter já nasce restrito a esse formato.

Ponto de disparo: `POST /api/leads` (`src/app/api/leads/route.ts`) — avisa o primeiro WhatsApp de `siteConfig.contact.phones` a cada novo lead (não newsletter), só se `WHATSAPP_LEAD_TEMPLATE_NAME` estiver configurada.

Pendente do lado do usuário (bloqueia mesmo com token configurado): criar o app em https://developers.facebook.com, configurar o número no WhatsApp Manager, gerar o token permanente (System User) e **criar e aguardar aprovação de um template de notificação de novo lead** (nome + variáveis do corpo — hoje o código manda 2 parâmetros posicionais: nome do lead e assunto de interesse) antes de preencher `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_LEAD_TEMPLATE_NAME`. Sem isso, cai no adapter no-op (só loga).

**Fora do escopo desta rodada, deliberadamente**: notificar `notifyTicketOrMessageEvent` (Tickets/Mensagens do Portal/Admin) por WhatsApp também — exigiria um campo de telefone por `profile` que não existe hoje no schema (`0001_core_schema.sql` só tem `email`), então seria uma migration + captura de dado nova, não só plugar um adapter. Avaliar se vale a pena quando/se o usuário pedir.

## Padrão a seguir (Adapter Pattern, seção 37)

A aplicação não deve depender diretamente de um provider. Estrutura de referência:

```text
src/integrations/
├── email/
│   ├── types.ts
│   ├── provider.ts
│   ├── resend.adapter.ts
│   └── index.ts
└── whatsapp-business/
    ├── types.ts
    ├── provider.ts
    ├── meta.adapter.ts
    └── index.ts
```

## Providers potenciais (seção 36) — nenhum confirmado ainda

| Categoria | Opções cogitadas |
|---|---|
| E-mail | Resend, Postmark, SendGrid, Amazon SES |
| WhatsApp | ~~Meta WhatsApp Business Platform~~ (escolhido, ver acima), BSP oficial |
| CRM | HubSpot, Pipedrive, RD Station CRM (cancelado, ver abaixo) |
| Automação | n8n, Make, Zapier |
| Assinatura | Clicksign, ZapSign, DocuSign, Adobe Acrobat Sign |
| Agenda | Google Calendar, Microsoft Graph, Calendly |
| Billing | Stripe, Mercado Pago, Pagar.me, Asaas |
| Observabilidade | Sentry, Datadog, OpenTelemetry |
| ERP/Fiscal | ~~Omie, Conta Azul, Nibo, PlugNotas, NFE.io~~ (Omie.G-Click escolhido, ver acima) |

Somente implementar uma integração após confirmar API oficial, plano, credenciais e documentação do provider escolhido.

## Pendências desta fase

- [x] E-mail — Resend escolhido e implementado (2026-09-17). Falta só a conta/domínio real do usuário (ver acima).
- [x] WhatsApp — Meta WhatsApp Business Platform (Cloud API) escolhido e implementado (2026-09-18). Falta a conta/número/template real do usuário (ver acima).
- [x] ~~CRM~~ — **cancelado pelo usuário em 2026-09-18**, fora do escopo da FASE 5.
- [x] ~~Armazenamento~~ — **removido em 2026-09-18**, já coberto pelo Supabase Storage (FASES 1/2).
- [~] ERP/Fiscal - Omie.G-Click escolhido (Fase 4); BLOCKED_BY_PROVIDER desde a auditoria técnica da Fase 6.5 (2026-09-20) - a implementação real usava a API errada (Omie ERP, não G-Click) e foi removida. Falta especificação técnica oficial (Postman) e credenciais reais.
- [ ] Automação, Assinatura, Cobrança — nenhuma decisão de provider tomada ainda.
