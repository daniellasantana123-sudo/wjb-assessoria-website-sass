/**
 * Interruptores da comercialização (Fase 8). Lidos em RUNTIME por acesso
 * dinâmico (nesta hospedagem o build não recebe as variáveis do painel).
 * Todos DESLIGADOS por padrão.
 */
function flag(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

/** Telas comerciais (landing, /portal/plano, /admin/comercial). */
export const isCommercialEnabled = () => flag("WJB_COMMERCIAL_ENABLED");

/** Exige assinatura (simulada) ativa para pedir NFS-e. */
export const isEntitlementEnforced = () => flag("WJB_COMMERCIAL_ENTITLEMENTS_ENFORCED");

/** Cobrança real: não existe nesta fase. Sempre falso, independente de variável. */
export const isRealBillingEnabled = () => false;
