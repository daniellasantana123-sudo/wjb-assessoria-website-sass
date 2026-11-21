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
  listOpenAgedSessions?(): Promise<string[]>;
}

/** Eventos que o sistema trata; o resto é registrado como ignorado. */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.finalized",
  "invoice.voided",
  "invoice.marked_uncollectible",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
] as const;
