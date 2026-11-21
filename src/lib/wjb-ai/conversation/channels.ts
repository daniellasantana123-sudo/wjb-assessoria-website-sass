/**
 * Adaptadores de canal do atendimento (Fase 7). O motor de conversa não sabe
 * por onde a mensagem chegou; cada canal implementa este contrato.
 *
 * Nesta fase só existe o canal INTERNO (chat do Portal de homologação). O
 * canal WhatsApp é só o contrato para a API oficial do WhatsApp Business:
 * não há token, número nem webhook configurado, e qualquer envio é recusado.
 */
export interface InboundMessage {
  channel: ChannelId;
  /** Identificador do remetente no canal; a empresa SEMPRE vem da sessão/vínculo. */
  senderRef: string;
  text: string;
  receivedAt: string;
}

export type ChannelId = "portal_interno" | "whatsapp_business";

export interface ConversationChannel {
  readonly id: ChannelId;
  readonly connected: boolean;
  send(recipientRef: string, text: string): Promise<{ delivered: boolean }>;
}

export class ChannelNotConnectedError extends Error {
  constructor(id: ChannelId) {
    super(`Canal ${id} não está conectado nesta fase.`);
    this.name = "ChannelNotConnectedError";
  }
}

/** Chat do Portal: a resposta volta na própria requisição, nada é disparado. */
export class InternalPortalChannel implements ConversationChannel {
  readonly id = "portal_interno" as const;
  readonly connected = true;
  async send(): Promise<{ delivered: boolean }> {
    return { delivered: true };
  }
}

/**
 * WhatsApp Business (API oficial da Meta). Contrato apenas: exige número
 * aprovado, token no cofre, webhook verificado, opt-in do titular e avaliação
 * de LGPD antes de qualquer uso. Nunca envia nesta fase.
 */
export class WhatsAppBusinessChannel implements ConversationChannel {
  readonly id = "whatsapp_business" as const;
  readonly connected = false;
  async send(): Promise<{ delivered: boolean }> {
    throw new ChannelNotConnectedError(this.id);
  }
}

export function getChannel(id: ChannelId): ConversationChannel {
  return id === "portal_interno"
    ? new InternalPortalChannel()
    : new WhatsAppBusinessChannel();
}
