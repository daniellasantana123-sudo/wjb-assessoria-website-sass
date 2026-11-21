"use server";

import { requireSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/supabase/server";
import { isRateLimited } from "@/lib/security/rate-limit";
import { getActiveTenant } from "@/lib/tenant";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import {
  nextTurn,
  sanitizeState,
  type ConversationState,
  type Turn,
} from "@/lib/wjb-ai/conversation/engine";

export type ConversationResult =
  ({ ok: true } & Turn) | { ok: false; error: string };

/**
 * Uma rodada do chat interno (Fase 7). Exige sessão de cliente com empresa
 * ativa; o estado vem do navegador e é revalidado aqui. Não grava pedido: a
 * criação só acontece quando o cliente confirma, pelo `submitNfseAction`
 * (mesmas regras do formulário). Encaminhamentos ficam no audit_log sem o
 * texto da conversa.
 */
export async function conversationTurnAction(
  rawState: unknown,
  message: string,
): Promise<ConversationResult> {
  if (!isWjbAiEnabled()) return { ok: false, error: "Recurso indisponível." };
  const session = await requireSession();
  if (session.isWjbStaff)
    return { ok: false, error: "O assistente é para clientes." };
  if (isRateLimited(`wjb-ai:chat:${session.userId}`, 30))
    return {
      ok: false,
      error: "Muitas mensagens em pouco tempo. Aguarde um minuto.",
    };
  const tenant = await getActiveTenant(session.userId);
  if (!tenant)
    return { ok: false, error: "Nenhuma empresa vinculada à sua conta." };
  if (typeof message !== "string" || !message.trim())
    return { ok: false, error: "Escreva uma mensagem." };

  const state: ConversationState = sanitizeState(rawState);
  const turn = nextTurn(state, message);
  if (turn.handoff) {
    const supabase = await createClient();
    await supabase.from("audit_log").insert({
      actor_id: session.userId,
      tenant_id: tenant.id,
      action: "fiscal.assistant_handoff",
      entity: "fiscal_assistant",
      entity_id: tenant.id,
      metadata: { turns: turn.state.turns },
    });
  }
  return { ok: true, ...turn };
}
