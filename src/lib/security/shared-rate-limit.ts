import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/db/supabase/admin";
import { isSupabaseConfigured } from "@/lib/db/supabase/server";

import { isRateLimited } from "./rate-limit";

/**
 * Limite de requisições compartilhado entre processos (Fase 10A): contador no
 * banco (`rate_limit_hit`, migration 0034), com a chave só em hash (nunca o
 * IP em claro). Se o banco não responder (ou a 0034 não existir), cai no
 * contador em memória por processo, que é o comportamento anterior: o
 * formulário nunca para por causa do limitador.
 */
export interface LimitRule {
  scope: string;
  max: number;
  windowSeconds: number;
}

export const hashKey = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);

export async function isRateLimitedShared(rule: LimitRule, key: string): Promise<boolean> {
  const bucket = `${rule.scope}:${hashKey(key)}`;
  if (isSupabaseConfigured() && process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    try {
      const { data, error } = await createAdminClient().rpc("rate_limit_hit", { p_bucket: bucket, p_window_seconds: rule.windowSeconds, p_max: rule.max });
      if (!error && typeof data === "boolean") return data;
    } catch {
      /* cai no contador em memória */
    }
  }
  // Reserva em memória (janela de 1 minuto): aplica o próprio limite da regra
  // nessa janela. Para regras por hora fica mais permissivo, mas nunca barra
  // um envio legítimo por erro de conta (a conversão proporcional dava 1/min).
  return isRateLimited(bucket, rule.max);
}

/**
 * IP de quem chama. Usa o primeiro `x-forwarded-for` (o cliente pode forjar):
 * por isso as regras públicas também têm um TETO GLOBAL por rota, que segura o
 * abuso mesmo com IP trocado. Ajustar para o cabeçalho confiável do proxy da
 * Hostinger quando ele for confirmado (pendência no doc 52).
 */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
}

/** Regras do formulário público de leads (contato, pré-cadastro, Dani, newsletter, popup). */
export const LEAD_LIMITS = {
  perIpMinute: { scope: "leads:ip:min", max: 5, windowSeconds: 60 },
  perIpHour: { scope: "leads:ip:hora", max: 30, windowSeconds: 3600 },
  globalHour: { scope: "leads:global:hora", max: 600, windowSeconds: 3600 },
} as const satisfies Record<string, LimitRule>;
