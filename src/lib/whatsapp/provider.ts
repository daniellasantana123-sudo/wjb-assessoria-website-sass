import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp da WJB (Fase 8): SÓ simulação. O número público (+55 11 97614-6375)
 * já é usado no site como link click-to-chat; isso NÃO significa que ele está
 * registrado na WhatsApp Business Platform (Cloud API) da Meta. Nada aqui
 * registra, migra ou envia mensagem real.
 */
export type MessageStatus = "pendente" | "entregue" | "erro";

export interface OutboundMessage {
  to: string; // referência do contato (nunca logada inteira)
  template?: string;
  text?: string;
}

export interface WhatsAppMessagingProvider {
  readonly mode: "mock" | "cloud_api";
  readonly connected: boolean;
  send(msg: OutboundMessage, consent: OptInRecord | null, now: Date): Promise<{ id: string; status: MessageStatus; reason?: string }>;
}

export interface OptInRecord {
  optedIn: boolean;
  optedOutAt: string | null;
}

export class WhatsAppNotConnectedError extends Error {
  constructor() {
    super("WhatsApp Cloud API não conectada: exige verificação da Meta, autorização e avaliação de LGPD.");
    this.name = "WhatsAppNotConnectedError";
  }
}

/** Horário de atendimento da WJB (seg-sex, 9h-18h, horário de Brasília). */
export function isBusinessHours(now: Date): boolean {
  const local = new Date(now.getTime() - 3 * 3_600_000);
  const day = local.getUTCDay();
  const h = local.getUTCHours();
  return day >= 1 && day <= 5 && h >= 9 && h < 18;
}

/**
 * Provedor simulado: aplica as regras que a integração real terá de seguir
 * (opt-in obrigatório, opt-out respeitado, fora do horário só com modelo
 * aprovado) e devolve estados determinísticos para teste.
 */
export class MockWhatsAppProvider implements WhatsAppMessagingProvider {
  readonly mode = "mock" as const;
  readonly connected = false;
  sent: { id: string; status: MessageStatus }[] = [];
  private seq = 0;

  async send(msg: OutboundMessage, consent: OptInRecord | null, now: Date): Promise<{ id: string; status: MessageStatus; reason?: string }> {
    const id = `SIMULADO-WA-${++this.seq}`;
    const fail = (reason: string) => {
      this.sent.push({ id, status: "erro" });
      return { id, status: "erro" as const, reason };
    };
    if (!consent?.optedIn || consent.optedOutAt) return fail("sem_opt_in");
    if (!msg.template && !isBusinessHours(now)) return fail("fora_do_horario_sem_modelo");
    if (!msg.template && !msg.text) return fail("mensagem_vazia");
    const status: MessageStatus = /falha/i.test(msg.text ?? "") ? "erro" : "entregue";
    this.sent.push({ id, status });
    return { id, status };
  }
}

/** Integração real: bloqueada até as dependências do doc 36 serem cumpridas. */
export function createCloudApiProvider(): WhatsAppMessagingProvider {
  throw new WhatsAppNotConnectedError();
}

// ---------------- Webhook (simulado) ----------------

/** Confere o cabeçalho X-Hub-Signature-256 ("sha256=<hex>") com o segredo do app. */
export function verifyWebhookSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const got = header.slice(7);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}

export interface InboundEvent {
  id: string;
  timestamp: number; // segundos
  fromRef: string;
  type: string;
}

/** Extrai eventos de mensagem do formato do webhook; ignora o resto. */
export function parseWebhookPayload(payload: unknown): InboundEvent[] {
  const out: InboundEvent[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const e of entries) {
    for (const c of ((e as { changes?: unknown[] }).changes ?? []) as { value?: { messages?: unknown[] } }[]) {
      for (const m of (c.value?.messages ?? []) as { id?: string; timestamp?: string; from?: string; type?: string }[]) {
        if (typeof m.id === "string" && /^\d+$/.test(m.timestamp ?? ""))
          out.push({ id: m.id.slice(0, 200), timestamp: Number(m.timestamp), fromRef: maskPhone(m.from ?? ""), type: String(m.type ?? "desconhecido") });
      }
    }
  }
  return out;
}

export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length >= 4 ? `***${d.slice(-4)}` : "***";
}

/** Anti-replay: recusa evento repetido ou fora da janela de 5 minutos. */
export class ReplayGuard {
  private seen = new Map<string, number>();
  constructor(private readonly windowSeconds = 300) {}
  accept(ev: InboundEvent, nowSeconds: number): "novo" | "repetido" | "fora_da_janela" {
    for (const [id, at] of this.seen) if (nowSeconds - at > this.windowSeconds * 2) this.seen.delete(id);
    if (Math.abs(nowSeconds - ev.timestamp) > this.windowSeconds) return "fora_da_janela";
    if (this.seen.has(ev.id)) return "repetido";
    this.seen.set(ev.id, nowSeconds);
    return "novo";
  }
}

/** Dependências para ligar a Cloud API (todas pendentes nesta fase). */
export const CLOUD_API_CHECKLIST = [
  "Confirmar a titularidade e o uso atual do número (app WhatsApp Business ou outro)",
  "Avaliar o impacto de registrar o número na Cloud API (coexistência ou migração)",
  "Acesso autorizado ao Meta Business Portfolio, WABA, número e app",
  "Verificação da empresa e configuração no painel oficial da Meta",
  "Credenciais do servidor no cofre e assinatura do webhook configurada",
  "Orçamento por tipo e volume de mensagens e modelos aprovados",
  "Política de opt-in/opt-out e avaliação de LGPD",
  "Teste com número autorizado e critérios de liberação comercial",
] as const;
