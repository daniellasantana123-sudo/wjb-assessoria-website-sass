import "server-only";

import { Resend } from "resend";

import type { EmailAdapter, SendEmailInput, SendEmailResult } from "./types";

/** Provider escolhido em 2026-09-17 (seção 36) — ver `docs/api/integrations.md`. */
export function createResendAdapter(apiKey: string, from: string): EmailAdapter {
  const client = new Resend(apiKey);

  return {
    async send({ to, subject, html, text, replyTo }: SendEmailInput): Promise<SendEmailResult> {
      const { error } = await client.emails.send({ from, to, subject, html, text, replyTo });
      if (error) {
        console.error("[email:resend] falha ao enviar:", error);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },
  };
}
