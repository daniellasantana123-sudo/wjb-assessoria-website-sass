import { isCommercialEnabled } from "@/lib/commercial/config";

/**
 * Pagamentos (Fase 9.1). Tudo lido em RUNTIME por acesso dinâmico (nesta
 * hospedagem o build não recebe as variáveis do painel) e DESLIGADO por padrão.
 *
 * - `WJB_PAYMENTS_ENABLED=true` liga o fluxo de pagamento (exige a
 *   comercialização ligada);
 * - `WJB_PAYMENTS_PROVIDER` = `mock` (padrão, sem Stripe) ou `stripe_test`;
 * - `stripe_test` exige chaves de TESTE (`sk_test_`/`rk_test_`, `pk_test_`,
 *   `whsec_`). Chave live é recusada sempre, com o fluxo inteiro desligado.
 */
const env = (name: string) => process.env[name]?.trim() ?? "";

export type PaymentsProviderKind = "mock" | "stripe_test";

export interface StripeKeyCheck {
  ok: boolean;
  problems: string[];
}

/** Confere só o FORMATO das chaves; nunca devolve nem registra o valor. */
export function checkStripeKeys(e: { secret: string; publishable: string; webhook: string }): StripeKeyCheck {
  const problems: string[] = [];
  const all = [e.secret, e.publishable, e.webhook];
  if (all.some((k) => /^(sk|rk|pk)_live_/.test(k))) problems.push("chave de PRODUÇÃO (live) recusada: este ambiente só aceita teste");
  if (!/^(sk|rk)_test_[A-Za-z0-9]{10,}$/.test(e.secret)) problems.push("STRIPE_SECRET_KEY ausente ou não é de teste");
  if (e.publishable && !/^pk_test_[A-Za-z0-9]{10,}$/.test(e.publishable)) problems.push("STRIPE_PUBLISHABLE_KEY não é de teste");
  if (!/^whsec_[A-Za-z0-9]{10,}$/.test(e.webhook)) problems.push("STRIPE_WEBHOOK_SECRET ausente");
  return { ok: problems.length === 0, problems };
}

export function stripeKeysFromEnv() {
  return { secret: env("STRIPE_SECRET_KEY"), publishable: env("STRIPE_PUBLISHABLE_KEY"), webhook: env("STRIPE_WEBHOOK_SECRET") };
}

export interface PaymentsStatus {
  enabled: boolean;
  provider: PaymentsProviderKind | null;
  problems: string[];
}

export function getPaymentsStatus(): PaymentsStatus {
  if (!isCommercialEnabled() || env("WJB_PAYMENTS_ENABLED").toLowerCase() !== "true") return { enabled: false, provider: null, problems: [] };
  const kind = (env("WJB_PAYMENTS_PROVIDER") || "mock") as PaymentsProviderKind;
  if (kind === "mock") return { enabled: true, provider: "mock", problems: [] };
  if (kind !== "stripe_test") return { enabled: false, provider: null, problems: ["WJB_PAYMENTS_PROVIDER inválido"] };
  const check = checkStripeKeys(stripeKeysFromEnv());
  return check.ok ? { enabled: true, provider: "stripe_test", problems: [] } : { enabled: false, provider: "stripe_test", problems: check.problems };
}

export const isPaymentsEnabled = () => getPaymentsStatus().enabled;

/** Cobrança real (live): não existe nesta fase. Sempre falso. */
export const isLivePaymentsEnabled = () => false;

/** Versão da API da Stripe fixada: formatos de objeto previsíveis. */
export const STRIPE_API_VERSION = "2024-06-20";
