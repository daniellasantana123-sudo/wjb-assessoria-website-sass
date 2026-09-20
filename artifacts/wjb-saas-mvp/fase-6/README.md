# Fase 6 - Notificações e suporte

## Objetivo original do prompt

Comunicação mínima dentro do SaaS: 6 tipos de notificação (`invitation`, `document_available`, `document_requested`, `integration_status`, `account_security`, `system_message`), canais in-app + e-mail (WhatsApp fica pra depois), modelo com `title`/`metadata_sanitized`, centro de notificações completo (badge, lista, marcar lida/todas, empty state), e "Precisa de ajuda?" no Dashboard (WhatsApp, e-mail, ticket).

## O que já existia (não recriado)

O centro de notificações in-app já existia desde a SAAS FASE 3 (2026-09-16): tabela `notifications`, fan-out por evento real de Tickets/Mensagens, badge de não lidas (sidebar do Portal, nav mobile, card do Admin), `/portal/notificacoes` e `/admin/notificacoes`. O e-mail transacional (Resend) já existia desde a Fase 5 de integrações (2026-09-17), plugado nesse mesmo fluxo. A infraestrutura de Tickets (`/portal/suporte`) já existia desde a SAAS FASE 3/4.

## O que foi construído nesta fase

1. **6 tipos de notificação** - `invitation`, `document_available`, `integration_status` e `account_security` ganharam disparo REAL (convites, documentos enviados, falha de sincronização Omie, suspensão/reativação de conta ou de vínculo). `document_requested` e `system_message` ficaram só definidas (título pronto) - nenhuma feature real dispara esses dois hoje, e inventar um disparo seria simular funcionalidade que não existe.
2. **Modelo estendido** - `title` e `metadata_sanitized` novos na tabela `notifications` (migration `0019`).
3. **"Marcar como lida"/"marcar todas como lidas" viraram ações explícitas** - antes (Fase 3) tudo era marcado como lido automaticamente ao visitar a página; agora cada notificação linka pra uma rota que marca só aquela e redireciona, e há um botão explícito "Marcar todas como lidas". Ver `decisions.md` D1.
4. **"Precisa de ajuda?"** - card novo no Dashboard do Portal com WhatsApp oficial, e-mail e "Abrir chamado" (ticket já existia).
5. **Sem dados sensíveis no assunto do e-mail** - assunto sempre um título genérico por tipo (`NOTIFICATION_TITLES`), nunca o conteúdo específico do evento.

Ver `architecture.md` para o detalhe técnico e `decisions.md` para o racional completo de cada corte de escopo.
