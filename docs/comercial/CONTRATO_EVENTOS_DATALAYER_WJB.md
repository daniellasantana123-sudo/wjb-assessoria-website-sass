# Contrato de eventos do dataLayer - WJB

Fonte de verdade dos eventos que o site envia ao Google Tag Manager. Código: `src/lib/analytics/datalayer.ts`.

## Regras garantidas pelo código

- Só os parâmetros da tabela abaixo passam. Nome, e-mail, telefone, CPF, CNPJ e mensagem são descartados mesmo que alguém tente enviá-los.
- Textos são cortados em 100 caracteres.
- Um `event_id` já enviado não é enviado de novo.
- O GTM só é baixado depois de "Aceitar todos" no banner de cookies. Antes disso, nenhum pedido vai ao Google.
- Telas de senha (`/login`, `/recuperar-senha`, `/definir-senha`, `/verificar-mfa`), Portal e Admin não têm GTM.

## Eventos

| Evento | Quando dispara | Parâmetros | Conversão no Google Ads? |
| --- | --- | --- | --- |
| `generate_lead` | Servidor confirmou que o lead foi gravado (`persisted: true`). Formulários de contato, proposta, serviços, assistente e popup de saída. | `event_id` (UUID do lead), `form_id`, `service_name`, `landing_page`, `lead_source`, `lead_medium`, `lead_campaign` | **Sim, principal** |
| `click_whatsapp` | Clique em qualquer link `wa.me` do site. | `link_location` (`home-hero`, `servico-topo`, `cabecalho`, `rodape`, `dialogo`, `pagina`...) | Secundária (não usar para lances) |
| `form_start` | Primeiro foco em um campo do formulário. | `form_id` | Não |
| `view_service` | Abertura de uma página de serviço. | `service_id` (slug), `service_name` | Não |
| `select_service` | Escolha de um serviço no assistente virtual. | `service_id`, `link_location` | Não |
| `chat_start` | Abertura do painel do assistente virtual. | `link_location` (`botao`, `direct_link`) | Não |
| `newsletter_signup` | Inscrição na newsletter gravada. | `event_id`, `form_id` | Não |

Todo evento leva também `page_path`.

### Por que o clique no WhatsApp não é conversão principal

O clique não prova que a conversa aconteceu. Usá-lo para lances faria o Google Ads otimizar para cliques, não para contatos. Fica como conversão secundária (só observação).

## Eventos do processo comercial (ainda não implementados)

`qualify_lead`, `working_lead` e `close_convert_lead` dependem de quem atende o lead marcar o andamento no Admin. Eles não podem ser disparados pelo navegador do visitante. O caminho previsto é a importação de conversões offline no Google Ads, usando o `gclid` que já é gravado com cada lead (coluna `gclid` da tabela `leads`).

`schedule_consultation` não existe: o site não tem agenda.
