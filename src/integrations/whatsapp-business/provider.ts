import "server-only";

import { createMetaWhatsAppAdapter } from "./meta.adapter";
import type { SendWhatsAppResult, SendWhatsAppTemplateInput, WhatsAppAdapter } from "./types";

/**
 * Sem `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` configuradas (conta
 * Meta Business/WABA ainda não criada, template ainda não aprovado), cai
 * num adapter no-op que só loga — mesmo padrão de `getEmailAdapter()`,
 * nunca quebra o fluxo que chamou.
 */
const noopAdapter: WhatsAppAdapter = {
  async sendTemplate(input: SendWhatsAppTemplateInput): Promise<SendWhatsAppResult> {
    console.log(
      `[whatsapp-business:noop] WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configuradas — template "${input.templateName}" não enviado (→ ${input.to})`,
    );
    return { ok: false, error: "no-provider" };
  },
};

let cached: WhatsAppAdapter | null = null;

export function getWhatsAppBusinessAdapter(): WhatsAppAdapter {
  if (cached) return cached;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  cached =
    accessToken && phoneNumberId ? createMetaWhatsAppAdapter(accessToken, phoneNumberId) : noopAdapter;
  return cached;
}
