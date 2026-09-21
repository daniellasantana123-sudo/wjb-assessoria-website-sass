/**
 * `Activity` morava em `src/types/pricing.ts` - movido pra cá em 2026-09-21
 * (remoção do simulador de honorários) porque era o único tipo daquele
 * arquivo ainda usado fora do próprio simulador (aqui, em `activityOptions`,
 * usado pelo dropdown "Ramo de atividade" do `LeadForm`).
 */
export type Activity = "services" | "commerce" | "mixed" | "industry" | "other";

export const activityOptions: { value: Activity; label: string }[] = [
  { value: "services", label: "Prestação de serviços" },
  { value: "commerce", label: "Comércio" },
  { value: "mixed", label: "Serviços + Comércio" },
  { value: "industry", label: "Indústria" },
  { value: "other", label: "Atividade especial / complexa" },
];

export const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function formatBRL(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    amount,
  );
}
