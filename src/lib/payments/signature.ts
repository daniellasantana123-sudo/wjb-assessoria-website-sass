import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Assinatura do webhook da Stripe (cabeçalho `Stripe-Signature`):
 * `t=<timestamp>,v1=<hmac>[,v0=...][,outros]`. O HMAC-SHA256 é calculado,
 * com o segredo do endpoint (`whsec_...`), sobre `"<t>.<corpo bruto>"`.
 * Aceita entradas desconhecidas e qualquer ordem; só `v1` autentica.
 * Tolerância padrão de 300 s contra repetição de requisição antiga.
 */
export type SignatureResult = { ok: true; timestamp: number } | { ok: false; reason: "cabecalho_invalido" | "fora_da_janela" | "assinatura_invalida" };

export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): SignatureResult {
  if (!header || !secret) return { ok: false, reason: "cabecalho_invalido" };
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t" && /^\d+$/.test(v)) t = Number(v);
    else if (k === "v1" && /^[0-9a-f]{64}$/.test(v)) v1.push(v);
  }
  if (t === null || v1.length === 0) return { ok: false, reason: "cabecalho_invalido" };
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return { ok: false, reason: "fora_da_janela" };
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex"), "hex");
  const ok = v1.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  return ok ? { ok: true, timestamp: t } : { ok: false, reason: "assinatura_invalida" };
}

/** Gera o cabeçalho (testes e provedor simulado). */
export function signStripePayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex")}`;
}
