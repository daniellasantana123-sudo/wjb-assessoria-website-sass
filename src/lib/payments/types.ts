/**
 * Contrato do provedor de pagamento (Fase 9.1). Objetos normalizados: o
 * resto do sistema não conhece o formato da Stripe. Nenhum dado de cartão
 * passa por aqui (só ids e valores).
 */
export interface PCheckoutSession {
  id: string;
  status: "open" | "complete" | "expired";
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  customerId: string | null;
  subscriptionId: string | null;
  clientReferenceId: string | null;
  url: string | null;
}
export interface PSubscription {
  id: string;
  status: string; // status da Stripe (active, past_due, canceled...)
  customerId: string | null;
  currentPeriodEnd: number | null; // segundos
  cancelAtPeriodEnd: boolean;
  priceId: string | null;
  itemId: string | null;
}
export interface PInvoice {
  id: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void";
  customerId: string | null;
  subscriptionId: string | null;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  periodStart: number | null;
  periodEnd: number | null;
  hostedInvoiceUrl: string | null;
}
export interface PCharge {
  id: string;
  invoiceId: string | null;
  customerId: string | null;
  amountRefundedCents: number;
  disputed: boolean;
}
export interface PEvent {
  id: string;
  type: string;
  livemode: boolean;
  objectId: string | null;
  /** Em contestação, a Stripe manda a disputa; aqui fica a cobrança relacionada. */
  relatedChargeId?: string | null;
}

export interface PaymentProvider {
  readonly mode: "mock" | "test";
  ensureCustomer(input: { tenantId: string; idempotencyKey: string }): Promise<string>;
  ensurePrice(input: { lookupKey: string; productName: string; amountCents: number; recurring: boolean }): Promise<{ priceId: string; productId: string }>;
  createCheckoutSession(input: {
    /**
     * subscription: assinatura mensal. setup: só cadastra o meio (nota
     * avulsa). payment (Fase 10E): pagamento único, para serviço adicional;
     * o preço vem do catálogo aprovado (nenhum preço é inventado no código).
     */
    kind: "subscription" | "setup" | "payment";
    customerId: string;
    priceId: string | null;
    successUrl: string;
    cancelUrl: string;
    clientReferenceId: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
    /** Opções de Pix Automático e boleto (Fase 10E); ausentes = padrão do Dashboard. */
    methodOptions?: CheckoutMethodOptions;
  }): Promise<{ id: string; url: string }>;
  expireCheckoutSession(id: string): Promise<void>;
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  cancelSubscription(input: { subscriptionId: string; atPeriodEnd: boolean; idempotencyKey: string }): Promise<void>;
  getCheckoutSession(id: string): Promise<PCheckoutSession>;
  getSubscription(id: string): Promise<PSubscription>;
  getInvoice(id: string): Promise<PInvoice>;
  getCharge(id: string): Promise<PCharge>;
  /** Troca o preço da assinatura; a diferença proporcional é faturada na hora. Devolve a fatura gerada, se houver. */
  changeSubscriptionPrice(input: { subscriptionId: string; newPriceId: string; idempotencyKey: string }): Promise<{ invoiceId: string | null }>;
  /** Quanto será cobrado (ou creditado, se negativo) agora pela troca. */
  previewPriceChange(input: { customerId: string; subscriptionId: string; newPriceId: string }): Promise<{ amountDueCents: number }>;
  /** Eventos recentes no provedor (reserva para webhook perdido). */
  listEvents(input: { createdGte: number }): Promise<PEvent[]>;
}

/**
 * Só os eventos necessários (decisão da WJB, 21/11/2026). O webhook na
 * Stripe deve assinar exatamente esta lista; o resto é registrado como
 * ignorado. Criação de assinatura é coberta por `checkout.session.completed`
 * + `customer.subscription.updated`; meios assíncronos (boleto/Pix) não são
 * usados em assinatura.
 */
/**
 * Fase 10E: opções dos métodos brasileiros no Checkout. Desligadas por
 * padrão; ligadas por variável de ambiente (config.ts) quando a WJB decidir.
 * - pixAutomaticMaxCents: limite que o cliente autoriza no banco (Pix
 *   Automático, só assinatura). Precisa cobrir o plano mais caro, senão a
 *   troca de plano falha na cobrança.
 * - boletoExpiresAfterDays: vencimento do boleto (0 a 60; padrão Stripe 3).
 * Nomes dos parâmetros conforme a documentação pública da Stripe (doc 04 da
 * Fase 10D); conferir no Sandbox antes de ligar.
 */
export interface CheckoutMethodOptions {
  pixAutomaticMaxCents?: number;
  boletoExpiresAfterDays?: number;
}

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  // Fase 10D: Pix e boleto são ASSÍNCRONOS. O Checkout termina "complete" com
  // pagamento "unpaid" (nada é liberado) e a confirmação chega depois por
  // estes eventos. Como em todos, o estado é buscado de novo no provedor.
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
] as const;
