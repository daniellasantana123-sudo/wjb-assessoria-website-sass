# 42 - Fase 9: WhatsApp por Click-to-Chat

**Decisão da WJB (21/11/2026):** usar Click-to-Chat. **Não** usar a WhatsApp Cloud API nem qualquer automação de mensagens. Este documento substitui o plano de integração do doc 36.

Número oficial: **+55 11 97614-6375** (`5511976146375`).

## 1. O que é (e o que não é)
O link `https://wa.me/5511976146375?text=...` só **abre uma conversa** com a WJB e deixa uma mensagem pronta. O cliente precisa tocar em enviar no próprio WhatsApp. Com ele **não existe**: envio automático, leitura de mensagens, webhook, confirmação de entrega, bot dentro do WhatsApp nem envio em nome do cliente.

O link fornecido pela WJB (`api.whatsapp.com/send/?phone=...&text=...`) tem o mesmo efeito. Usamos o formato oficial curto `wa.me`, que o site já usava, gerado num só lugar.

## 2. Implementação
| Item | Onde |
| --- | --- |
| Número e gerador de links centralizados (nenhuma página monta link à mão; confirmado por busca no código) | `src/config/site.ts` (`contact.phones[0]`), `src/integrations/whatsapp/index.ts` |
| Mensagens por intenção, numa lista fechada: MEI Digital, só emissão, combo, alto volume, contabilidade, dúvida sobre emissão. A função aceita só a intenção, nunca texto livre, então nenhum dado do cliente entra no link | `commercialWhatsAppMessages`, `getCommercialWhatsAppLink(intent)` |
| Codificação com `encodeURIComponent` (acentos, "!", "+") | teste unitário confere a decodificação |
| Aviso de expectativa junto aos botões: "Abre o WhatsApp com uma mensagem pronta. Nada é enviado até você tocar em enviar." | `whatsAppClickToChatNotice` |
| CTAs em `/emissao-de-notas` (topo, formas de contratar, cada plano, dúvidas), em `/planos` (só emissão e combo), no Portal (Alto Volume) e na Dani | páginas e `AssistantCommercial` |
| Medição: só o clique (`click_whatsapp`, pela delegação já existente em `GoogleTagManager`), com consentimento de cookies e com `data-analytics-location` indicando a origem. Nunca registra que a conversa foi enviada, entregue ou respondida, porque nada confirma isso | componentes de analytics existentes |
| Tela no Admin com as mensagens e "Testar o link" | `/admin/whatsapp` |
| **Removido** o webhook e o provedor simulados da Fase 8 (`/api/wjb-ai/whatsapp/webhook`, `src/lib/whatsapp/provider.ts`): não há nenhum módulo de API do WhatsApp no código | E2E: o caminho do webhook responde 404 em GET e POST |

Botão flutuante: não foi criado nenhum botão novo de WhatsApp. O canto inferior direito continua só com a Dani, que já leva ao WhatsApp. Assim não há dois botões flutuantes no celular.

## 3. Testes
- Unitário: número certo, mensagem decodificada igual à da intenção, nenhum espaço sem codificação, nenhuma mensagem com número longo, e-mail, CPF/CNPJ ou valor.
- E2E (homologação): todo link `wa.me` do conteúdo de `/emissao-de-notas` e `/planos` aponta para `wa.me/5511976146375` e usa uma mensagem da lista. O rodapé fica de fora porque lista os números de contato sem mensagem, desde antes desta fase.
- **Não testado:** abrir os links no WhatsApp Web, no aplicativo de computador, no Android e no iOS. Não há aparelhos disponíveis aqui, e emulador não substitui esse teste.

## 4. Achado para a WJB decidir
O rodapé e `siteConfig` listam **dois** WhatsApp da WJB: (11) 9 7614-6375 (oficial, usado em todos os CTAs) e um segundo número, (11) 9 7685-4842. A decisão da Fase 9 cita só o primeiro. O segundo continua no rodapé até a WJB dizer se deve sair.

## 5. Para o futuro
Atendimento automatizado de ponta a ponta fica no chat do site (Dani). Automação **dentro** do WhatsApp exigiria um canal oficial compatível (WhatsApp Business Platform) e uma decisão própria da WJB (doc 46, Fase 10). Nunca usar automação por QR Code, sessão não oficial do WhatsApp Web ou bibliotecas não autorizadas.
