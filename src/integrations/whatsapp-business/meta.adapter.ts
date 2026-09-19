import "server-only";

import type { SendWhatsAppResult, SendWhatsAppTemplateInput, WhatsAppAdapter } from "./types";

const GRAPH_API_VERSION = "v21.0";

/**
 * Provider escolhido em 2026-09-18 (seção 36) — Meta WhatsApp Business
 * Platform (Cloud API) direto, sem BSP intermediário: é a própria API
 * oficial (seção 35), sem custo de middleman e sem SDK novo (REST simples
 * via `fetch`) — ver `docs/api/integrations.md`.
 */
export function createMetaWhatsAppAdapter(accessToken: string, phoneNumberId: string): WhatsAppAdapter {
  return {
    async sendTemplate({
      to,
      templateName,
      languageCode = "pt_BR",
      bodyParams = [],
    }: SendWhatsAppTemplateInput): Promise<SendWhatsAppResult> {
      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: templateName,
              language: { code: languageCode },
              ...(bodyParams.length > 0
                ? {
                    components: [
                      {
                        type: "body",
                        parameters: bodyParams.map((text) => ({ type: "text", text })),
                      },
                    ],
                  }
                : {}),
            },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[whatsapp-business:meta] falha ao enviar:", response.status, errorBody);
        return { ok: false, error: `graph-api-${response.status}` };
      }

      return { ok: true };
    },
  };
}
