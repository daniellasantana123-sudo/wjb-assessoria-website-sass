import "server-only";

/**
 * Comprovante de que o portão de transmissão estava ABERTO (Fase 10B,
 * revisão de segurança). Só `requireOpenGate` cria um; o transporte oficial
 * com cliente mTLS real exige recebê-lo, então nenhum envio ao governo pode
 * ser montado sem passar pelo portão.
 */
const BRAND = Symbol("wjb-ai.open-gate");

export class OpenGateToken {
  readonly [BRAND] = true;
  private constructor(readonly openedAt: Date) {}
  /** @internal uso exclusivo de transmission-gate.ts */
  static issue(): OpenGateToken {
    return new OpenGateToken(new Date());
  }
}

export function isOpenGateToken(v: unknown): v is OpenGateToken {
  return v instanceof OpenGateToken;
}
