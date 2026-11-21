# 36 - Fase 8: WhatsApp da WJB (plano de integração)

> **Substituído em 21/11/2026 (Fase 9):** a WJB decidiu não usar a Cloud API. O canal é Click-to-Chat (doc 42), e o webhook e o provedor simulados descritos abaixo foram removidos do código.

**Número:** +55 11 97614-6375 (formato internacional E.164: `5511976146375`).
**Situação:** **não conectado à WhatsApp Cloud API.** Nada foi registrado, migrado nem desconectado, e nenhuma mensagem real foi enviada.

## 1. O que já existe e não mudou
O site usa o número como link de conversa (`wa.me`), com uma mensagem já escrita. Isso **não** quer dizer que o número esteja na WhatsApp Business Platform. O uso atual dele (aplicativo WhatsApp Business ou outro) não foi alterado.

## 2. O que foi implementado (simulação)
| Peça | Arquivo | Comportamento |
| --- | --- | --- |
| Provedor simulado | `src/lib/whatsapp/provider.ts` (`MockWhatsAppProvider`) | exige opt-in, respeita opt-out e o horário de atendimento (seg-sex, 9h-18h, Brasília). Fora do horário, só com modelo de mensagem. Os ids começam com `SIMULADO-WA-` |
| Provedor real | `createCloudApiProvider()` | **dá erro sempre** (`WhatsAppNotConnectedError`) |
| Webhook | `src/app/api/wjb-ai/whatsapp/webhook/route.ts` | responde 404 a menos que `WJB_COMMERCIAL_ENABLED` e `WJB_WHATSAPP_MOCK_ENABLED` estejam ligados. Confere a assinatura `X-Hub-Signature-256` (HMAC-SHA256, comparação em tempo constante), recusa evento repetido ou fora da janela de 5 minutos, limita 60 requisições por minuto e 100 KB. Não guarda conteúdo de mensagem nem telefone |
| Máscara | `maskPhone` | telefone aparece só como `***` + os 4 últimos dígitos |
| Tela | `/admin/whatsapp` | mostra o número, o selo "Não conectado à Cloud API" e o checklist abaixo |

Testes: 4 unitários (opt-in, horário, assinatura, anti-replay e máscara) e 1 E2E na homologação (assinatura inválida = 401, válida = aceita, repetição = recusada, tela).

## 3. O que é preciso para ligar a Cloud API (tudo pendente)
1. Confirmar quem é o titular do número e como ele é usado hoje.
2. Avaliar o impacto de registrar o número: coexistência com o aplicativo ou migração. **A migração pode tirar o número do aplicativo WhatsApp Business**, por isso exige autorização específica.
3. Acesso autorizado ao portfólio empresarial da Meta, à conta do WhatsApp Business (WABA), ao número e ao app.
4. Verificação da empresa no painel oficial da Meta.
5. Credenciais do servidor no cofre e o segredo do webhook configurado (nunca no chat nem no Git).
6. Orçamento: a Meta cobra por tipo de mensagem e por país. Consultar a tabela oficial vigente, que não foi verificada nesta fase.
7. Modelos de mensagem aprovados, política de opt-in e opt-out, e avaliação de LGPD.
8. Teste com um número autorizado e critérios para liberar o uso comercial.

## 4. Fora do escopo desta fase
- Pedir token, PIN, código de verificação ou QR Code pelo chat.
- Ligar o canal WhatsApp ao assistente de pedidos de NFS-e. O contrato existe em `conversation/channels.ts` e recusa enviar.
