# Instalação do Google Tag Manager, GA4 e Google Ads - WJB

O código do site está pronto e desligado. Para ligar são necessários três identificadores da conta da WJB. Nenhum foi criado ou inventado.

## 1. O que a WJB precisa fornecer

| Item | Formato | Onde encontrar |
| --- | --- | --- |
| ID do contêiner do Tag Manager | `GTM-XXXXXXX` | tagmanager.google.com, ao lado do nome do contêiner |
| ID de medição do GA4 | `G-XXXXXXXXXX` | GA4 > Administrador > Fluxos de dados > Web |
| ID e rótulo de conversão do Google Ads | `AW-XXXXXXXXX` / `abcDEF123` | Google Ads > Metas > Conversões > a ação "Lead do site" > Configurar tag > Usar o Gerenciador de tags |

Só o ID do GTM entra no código. Os outros dois são configurados dentro do GTM.

## 2. Ligar no site (uma linha)

`src/config/analytics.ts`, campo `gtmId`. Depois é só commit e push. O ID é público por natureza (aparece no HTML de qualquer site com GTM), por isso fica no código e não no painel da Hostinger, que não repassa variáveis ao build.

## 3. Configuração dentro do GTM

### Variáveis (Variáveis > Novo > Variável da camada de dados)

`event_id`, `form_id`, `service_name`, `service_id`, `link_location`, `lead_source`, `lead_medium`, `lead_campaign`, `landing_page`.

### Acionadores (Acionadores > Novo > Evento personalizado)

Um por evento do contrato: `generate_lead`, `click_whatsapp`, `form_start`, `view_service`, `select_service`, `chat_start`, `newsletter_signup`.

### Tags

| Tag | Tipo | Acionador | Observação |
| --- | --- | --- | --- |
| Google tag (GA4) | Tag do Google, ID `G-...` | Initialization - All Pages | |
| GA4 - eventos | Evento do GA4, nome `{{Event}}` | Os 7 acionadores acima | Enviar como parâmetros as variáveis da camada de dados |
| Vinculador de conversões | Vinculador de conversões | All Pages | Necessário para o Google Ads ler o clique do anúncio |
| Ads - Lead do site | Acompanhamento de conversões do Google Ads | `generate_lead` | ID e rótulo da ação; **ID da transação = `{{event_id}}`** (deduplicação) |
| Ads - WhatsApp | Acompanhamento de conversões do Google Ads | `click_whatsapp` | Ação marcada como **secundária** no Google Ads |
| Ads - Remarketing | Remarketing do Google Ads | All Pages | Opcional |

### Consentimento

O site já envia os 4 sinais do Consent Mode v2 (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`), negados por padrão e concedidos só em "Aceitar todos". No GTM, em Administrador > Configurações do contêiner, ative "Ativar visão geral do consentimento". As tags do Google já respeitam os sinais sozinhas; não é preciso configurar consentimento adicional nelas.

### No GA4

Administrador > Eventos: marcar `generate_lead` como evento principal (conversão). Os demais ficam como eventos comuns.

## 4. Testar antes de publicar

1. GTM > Visualizar, abrir `https://wjbassessoriacontabil.com.br`.
2. No banner, clicar em "Aceitar todos" (antes disso o GTM não carrega, de propósito).
3. Abrir uma página de serviço: deve aparecer `view_service`.
4. Clicar no botão de WhatsApp: `click_whatsapp`.
5. Enviar um formulário de teste: `generate_lead` com `event_id`. Apagar o lead de teste no Admin depois.
6. Conferir em GA4 > Administrador > DebugView.
7. Publicar o contêiner.

Se o banner já tiver sido respondido no navegador de teste, usar "Preferências de cookies" no rodapé para fazê-lo voltar.

## 5. Modo de consentimento escolhido: básico

O GTM só carrega depois do aceite. É o mais conservador para a LGPD e corresponde ao texto do banner. O custo: o Google Ads não modela conversões de quem recusa. Mudar para o modo avançado (GTM sempre carregado, com sinais negados) é decisão jurídica da WJB e exige revisar a política de cookies.
