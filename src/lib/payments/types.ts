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
    kind: "subscription" | "setup";
    customerId: string;
    priceId: string | null;
    successUrl: string;
    cancelUrl: string;
    clientReferenceId: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
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
