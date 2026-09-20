# Integrações

> Status: **SAAS FASE 5 iniciada** (2026-09-17) — E-mail (Resend) e WhatsApp (Meta WhatsApp Business Platform) implementados. **CRM e Armazenamento cancelados pelo usuário em 2026-09-18** (fora do escopo da FASE 5 — Armazenamento já coberto pelo Supabase Storage das FASES 1/2). Automação e Assinatura seguem na FASE 0. **Cobrança** não é mais nesta lista de "nenhuma decisão" - ver Omie.G-Click abaixo, implementado na Fase 4 do wjb-saas-mvp (2026-09-20). Referência completa nas seções 35–37 de [`../../Wjb-Website.md`](../../Wjb-Website.md).

## ERP/Fiscal - Omie.G-Click, implementado (parcial) em 2026-09-20

**Reverte a decisão de 2026-09-16** ("nenhuma integração de ERP/fiscal externo"), por instrução explícita do usuário na Fase 4 do wjb-saas-mvp - ver `artifacts/wjb-saas-mvp/fase-4/decisions.md` D1 para o histórico completo da contradição/reversão.

Estrutura: `src/integrations/omie-gclick/{types.ts,provider.ts,omie.adapter.ts,index.ts}` - mesmo Adapter Pattern de e-mail/WhatsApp. `getOmieGClickAdapter()` cai num adapter no-op (só loga, nunca lança) sem `OMIE_APP_KEY`/`OMIE_APP_SECRET` configuradas.

**Só o recurso "clientes" foi implementado** (`upsertClient` - `IncluirCliente`/`AlterarCliente` da API pública do Omie, envelope `call`/`app_key`/`app_secret`/`param`, sempre HTTP 200 mesmo em erro, com `faultstring`/`faultcode` no corpo). **"Tarefas"/"pré-tarefas" (mencionadas no prompt da Fase 4) não foram implementadas** - nenhuma documentação pública verificada nesta sessão para esses recursos do G-Click especificamente; ver `decisions.md` D2. Implementação **não testada contra uma conta Omie real** (nenhuma credencial disponível nesta sessão) - mesma ressalva já registrada para o adapter Meta WhatsApp quando foi implementado.

Mapeamento por organization (`omie_client_mappings`, `0017_omie_gclick_integration.sql`) - 1 linha por tenant, nunca direto a um usuário. Staff configura manualmente (`external_client_id`, `external_portal_url`) em `/admin/empresas/[id]` e pode acionar "Sincronizar com o Omie.G-Click" (Server Action `syncOmieClient`, que É o BFF do fluxo do prompt mestre - não existe endpoint REST paralelo, mesma decisão D3 da Fase 1). Cliente vê um CTA "Ver no Portal Contábil" no Portal (`/portal`) só quando staff configurou o link e o status é `connected`/`synced` - link externo em nova aba, nunca iframe, nunca SSO.

Resiliência: nenhum caminho crítico (login, documentos, Dashboard) chama o adapter Omie - só a ação explícita de staff. O adapter tem timeout de 10s e nunca lança exceção, sempre resolve com `{ok:false, error}`.

Pendente do lado do usuário: criar/confirmar a conta Omie, gerar `app_key`/`app_secret`, e fornecer documentação oficial de "tarefas"/"pré-tarefas" do G-Click antes de estender o adapter - sem isso, a sincronização de clientes cai no adapter no-op e as demais funcionalidades do prompt mestre continuam fora do escopo implementado.

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
- [x] ERP/Fiscal - Omie.G-Click escolhido e parcialmente implementado (2026-09-20, Fase 4 do wjb-saas-mvp). Falta credencial real, e "tarefas"/"pré-tarefas" seguem sem documentação verificada.
- [ ] Automação, Assinatura, Cobrança — nenhuma decisão de provider tomada ainda.
