export interface SendWhatsAppTemplateInput {
  /** E.164 sem "+" (mesmo formato de `siteConfig.contact.phones[].e164`). */
  to: string;
  templateName: string;
  languageCode?: string;
  /** Parâmetros posicionais ({{1}}, {{2}}, ...) do corpo do template aprovado. */
  bodyParams?: string[];
}

export interface SendWhatsAppResult {
  ok: boolean;
  error?: string;
}

/**
 * Contrato que qualquer provider de WhatsApp Business precisa cumprir
 * (Adapter Pattern, `docs/api/integrations.md`) — a aplicação nunca chama
 * o SDK/API de um provider específico diretamente, só esta interface.
 *
 * Só `sendTemplate` (não uma `send` de texto livre): a Cloud API da Meta só
 * aceita mensagem de texto livre dentro de uma janela de 24h iniciada pelo
 * cliente. Uma notificação iniciada pela WJB (ex.: aviso de novo lead) é
 * sempre "business-initiated" e exige um template (HSM) pré-aprovado pela
 * Meta — ver `docs/api/integrations.md`.
 */
export interface WhatsAppAdapter {
  sendTemplate(input: SendWhatsAppTemplateInput): Promise<SendWhatsAppResult>;
}
