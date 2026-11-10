"use client";

import { useEffect } from "react";

import { pushEvent } from "@/lib/analytics/datalayer";
import { clearGoogleCookies, loadGtm, updateConsentMode } from "@/lib/consent/consent-mode";
import { getStoredConsent, subscribeConsent } from "@/lib/consent/cookie-consent";

/**
 * Reage às escolhas do banner de cookies (aceitar, recusar, revogar) e
 * registra os cliques em WhatsApp do site inteiro.
 *
 * O padrão "negado" e a reaplicação de uma escolha já salva são feitos antes,
 * no script embutido do `<head>` (`buildConsentBootstrapScript`) - este
 * componente cuida só do que muda depois que a página abriu.
 */
export function GoogleTagManager({ gtmId }: { gtmId: string }) {
  useEffect(() => {
    let previous = getStoredConsent();
    const unsubscribe = subscribeConsent(() => {
      const current = getStoredConsent();
      if (current === previous) return;
      if (current === "accepted") {
        updateConsentMode(true);
        loadGtm(gtmId);
      } else if (previous === "accepted") {
        updateConsentMode(false);
        clearGoogleCookies();
      }
      previous = current;
    });
    return () => {
      unsubscribe();
    };
  }, [gtmId]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (!/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(link.href)) return;
      // Nunca enviar o endereço do link: a mensagem pré-preenchida do
      // WhatsApp pode conter o nome da pessoa (assistente virtual).
      pushEvent("click_whatsapp", { link_location: getLinkLocation(link) });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}

/** Onde o botão está, para comparar CTAs sem precisar marcar cada um. */
function getLinkLocation(link: Element): string {
  const marked = link.closest("[data-analytics-location]");
  if (marked) return marked.getAttribute("data-analytics-location") ?? "desconhecido";
  if (link.closest("header")) return "cabecalho";
  if (link.closest("footer")) return "rodape";
  if (link.closest('[role="dialog"]')) return "dialogo";
  const section = link.closest("section[id], section[aria-labelledby]");
  if (section) return section.id || section.getAttribute("aria-labelledby") || "secao";
  return "pagina";
}
