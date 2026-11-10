"use client";

import { clearConsent } from "@/lib/consent/cookie-consent";
import { cn } from "@/lib/utils";

/**
 * Reabre o banner de cookies para a pessoa rever ou revogar a escolha.
 * Revogar precisa ser tão fácil quanto aceitar (LGPD, art. 8º, § 5º).
 */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => clearConsent()}
      className={cn(
        "focus-visible:ring-primary rounded-md text-left underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      Preferências de cookies
    </button>
  );
}
