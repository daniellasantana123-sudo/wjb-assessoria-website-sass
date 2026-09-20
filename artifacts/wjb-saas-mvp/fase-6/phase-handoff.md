# Handoff - Fase 6 para a próxima fase

## O que está pronto

- 4 tipos de notificação com disparo real: `invitation`, `document_available`, `integration_status`, `account_security` - somados aos 4 já existentes (`ticket.*`, `message.sent`).
- Modelo estendido (`title`, `metadata_sanitized`).
- "Marcar como lida"/"marcar todas como lidas" como ações explícitas (mudança de comportamento em relação à Fase 3 - ver `decisions.md` D1).
- "Precisa de ajuda?" no Dashboard do Portal (WhatsApp, e-mail, ticket).
- Assunto de e-mail sempre genérico, nunca revela dado específico do evento.
- Lint, typecheck, 170 testes e build - todos limpos.

## O que ficou deliberadamente fora desta fase

- `document_requested`/`system_message` - sem disparo real, sem feature que os justifique. Ver `decisions.md` D4.
- WhatsApp como canal de notificação - o próprio prompt permite adiar.
- Resumo por e-mail de sincronizações Omie bem-sucedidas - só falha notifica, e só in-app.

## Pendências herdadas de fases anteriores (ainda não resolvidas)

- Credenciais do projeto Supabase real continuam ausentes - nada desta fase foi testado contra banco/e-mail reais, só via mocks.
- `RESEND_API_KEY`/`EMAIL_FROM` continuam ausentes em produção - todo e-mail desta fase cai no adapter no-op até isso ser configurado (mesmo comportamento esperado desde a Fase 5 de integrações).
- `.env.example`/`.github/workflows/` continuam ausentes (Fase 0).

## Riscos

- **Mudança de comportamento em "marcar como lida"** - quem já usava o Portal/Admin vai notar que visitar a página de notificações não marca mais tudo como lido sozinho; agora precisa clicar. Documentado em `decisions.md` D1, mas vale avisar a WJB antes de publicar, já que é uma mudança de hábito perceptível.
- **Mobile não verificado visualmente** - sem ferramenta de navegador nesta sessão (ver `decisions.md` D7). Recomendado validar `SupportCard` e a lista de notificações num dispositivo real antes de publicar.
- **`document_available` pode gerar volume alto de e-mail** se um cliente enviar muitos documentos seguidos (um e-mail por upload, sem agrupamento/debounce) - reconsiderar se isso incomodar o uso real (ex.: resumo diário em vez de e-mail por arquivo).

## Próxima fase

Não definida - aguardando o próximo prompt numerado do usuário.
