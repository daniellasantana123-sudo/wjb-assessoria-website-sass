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

## E-mail (Resend) — implementado em 2026-09-17

Estrutura seguida à risca (ver seção abaixo): `src/integrations/email/{types.ts,provider.ts,resend.adapter.ts,templates.ts,index.ts}`. `getEmailAdapter()` cai num adapter no-op (só loga) sem `RESEND_API_KEY`/`EMAIL_FROM` configuradas — nunca quebra quem chamou.

Pontos de disparo:
- `notifyTicketOrMessageEvent` (`src/lib/notifications.ts`) — além da notificação in-app já existente, envia e-mail para cada destinatário com e-mail cadastrado (staff avisado de nova mensagem/ticket de cliente, e vice-versa).
- `POST /api/leads` (`src/app/api/leads/route.ts`) — avisa `siteConfig.contact.email` a cada novo lead do formulário (não para inscrições de newsletter, pra não gerar um e-mail por assinante).

**Configurado e funcionando em produção desde 2026-09-23.** Domínio verificado no Resend: `wjbassessoriacontabil.com.br` (raiz); `EMAIL_FROM` = `WJB Assessoria Contábil <nao-responda@wjbassessoriacontabil.com.br>`; `RESEND_API_KEY` configurada no painel da Hostinger. Entrega confirmada de ponta a ponta (lead de teste → `Delivered` no painel do Resend → caixa `contato@`).

O aviso de novo lead usa `replyTo` com o e-mail do próprio lead (2026-09-23) — responder a notificação fala direto com o cliente, em vez de voltar pro endereço técnico de envio.

**Armadilha que custou um ciclo de deploy**: `EMAIL_FROM` precisa ser um endereço **do domínio verificado**. Estava apontando pra um subdomínio (`envios.wjbassessoriacontabil.com.br`) que nunca foi cadastrado no Resend — o envio é recusado antes de virar registro no log de *Emails*, então o sintoma é "nenhum envio aparece", não "envio com erro". Se um dia migrar pra subdomínio (boa prática de isolamento de reputação), cadastre e verifique ele no Resend **antes** de mudar a variável.

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

- [x] E-mail — Resend escolhido e implementado (2026-09-17); **conta, domínio verificado e env vars de produção concluídos em 2026-09-23**, com entrega confirmada de ponta a ponta. Nada pendente.
- [x] WhatsApp — Meta WhatsApp Business Platform (Cloud API) escolhido e implementado (2026-09-18). Falta a conta/número/template real do usuário (ver acima).
- [x] ~~CRM~~ — **cancelado pelo usuário em 2026-09-18**, fora do escopo da FASE 5.
- [x] ~~Armazenamento~~ — **removido em 2026-09-18**, já coberto pelo Supabase Storage (FASES 1/2).
- [~] ERP/Fiscal - Omie.G-Click escolhido (Fase 4); mock funcional (`GCLICK_MODE=mock`) desde a Fase 6.5 de mocks/contratos internos (2026-09-20) - real segue `BLOCKED_BY_PROVIDER`, faltando especificação técnica oficial (Postman) e credenciais reais. Ver `docs/integrations/gclick/`.
- [ ] Automação, Assinatura, Cobrança — nenhuma decisão de provider tomada ainda.
