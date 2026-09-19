export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

/**
 * Contrato que qualquer provider de e-mail transacional precisa cumprir
 * (Adapter Pattern, `docs/api/integrations.md`) — a aplicação nunca chama
 * o SDK de um provider específico diretamente, só esta interface.
 */
export interface EmailAdapter {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
