import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Card que É um link/botão de navegação (2026-09-17, a pedido do usuário —
 * elevar o padrão de UI/UX da Home). Consolida um padrão que já existia
 * duplicado quase palavra-por-palavra em `needs-picker.tsx`,
 * `services-preview.tsx` e `post-card.tsx` — um lugar só pra manter
 * consistente daqui pra frente. Lift + borda + sombra + anel de foco: só
 * faz sentido em algo que realmente responde a clique/Enter.
 */
export const navigableCardClass =
  "border-border hover:border-primary focus-visible:ring-primary rounded-md border transition-all duration-200 hover:-translate-y-1 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Card informativo, sem link/clique (os passos de `how-it-works`, os
 * blocos de `human-plus-tech` etc.). Deliberadamente mais discreto que
 * `navigableCardClass` — sem lift nem anel de foco, pra não sugerir uma
 * interatividade que não existe (só uma sombra suave ao passar o mouse).
 */
export const staticCardHoverClass = "transition-shadow duration-200 hover:shadow-md";
