import "server-only";

import { createResendAdapter } from "./resend.adapter";
import type { EmailAdapter, SendEmailInput, SendEmailResult } from "./types";

/**
 * Sem `RESEND_API_KEY`/`EMAIL_FROM` configuradas (dev local, checkout limpo,
 * domínio ainda não verificado no Resend), cai num adapter no-op que só loga
 * — mesmo padrão de `AnalyticsLoader`, nunca quebra o fluxo que chamou.
 */
const noopAdapter: EmailAdapter = {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    console.log(
      `[email:noop] RESEND_API_KEY/EMAIL_FROM não configuradas — e-mail não enviado ("${input.subject}" → ${input.to})`,
    );
    return { ok: false, error: "no-provider" };
  },
};

let cached: EmailAdapter | null = null;

export function getEmailAdapter(): EmailAdapter {
  if (cached) return cached;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  cached = apiKey && from ? createResendAdapter(apiKey, from) : noopAdapter;
  return cached;
}
