"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

import { trackAssistantEvent } from "@/lib/analytics/assistant-events";
import { getContextualGreeting } from "@/lib/assistant/assistant-flow";
import {
  getServerScreenSnapshot,
  getServerServiceSnapshot,
  getServerWidgetStateSnapshot,
  getStoredScreen,
  getStoredService,
  getStoredWidgetState,
  hasShownGreeting,
  markGreetingShown,
  setStoredScreen,
  setStoredService,
  setStoredWidgetState,
  subscribeAssistantStorage,
} from "@/lib/assistant/assistant-storage";
import {
  getServerConsentSnapshot,
  getStoredConsent,
  subscribeConsent,
} from "@/lib/consent/cookie-consent";
import { getAssistantWhatsAppLink } from "@/lib/assistant/whatsapp";
import type { AssistantServiceKey } from "@/types/assistant";

import { AssistantLauncher } from "./AssistantLauncher";
import { AssistantPanel } from "./AssistantPanel";

const GREETING_DELAY_MS = 5000;

/**
 * Orquestrador do Assistente Virtual WJB. Substitui o botão flutuante
 * independente do WhatsApp (prompt mestre do assistente, seção "AJUSTE
 * IMPORTANTE") como principal ponto de entrada de atendimento no canto
 * inferior direito - o WhatsApp continua acessível de dentro do painel
 * (`AssistantPanel`, CTA "Falar direto com um especialista") e reaproveita
 * a mesma integração/número já existentes (`@/integrations/whatsapp`).
 *
 * Estado dividido em duas camadas: a baseline persistida em sessionStorage
 * (fechado/minimizado, tela atual, serviço escolhido - lida via
 * `useSyncExternalStore`, mesmo padrão já usado no projeto pra persistência
 * client-side) e
 * um overlay local (`greeting`/`open`) puramente transitório da aba atual,
 * que nunca é persistido. Isso evita restaurar sessão via `useEffect` +
 * `setState` (rejeitado pelo lint `react-hooks/set-state-in-effect`) e, de
 * quebra, evita reabrir o painel sozinho depois de uma navegação/reload.
 */
export function WJBAssistant() {
  const pathname = usePathname();
  const router = useRouter();

  const persistedWidgetState = useSyncExternalStore(
    subscribeAssistantStorage,
    getStoredWidgetState,
    getServerWidgetStateSnapshot,
  );
  const screen = useSyncExternalStore(
    subscribeAssistantStorage,
    getStoredScreen,
    getServerScreenSnapshot,
  );
  const selectedService = useSyncExternalStore(
    subscribeAssistantStorage,
    getStoredService,
    getServerServiceSnapshot,
  );
  // Banner de cookies (mesma fonte usada por CookieConsentBanner) - enquanto
  // `consent` for null, o banner está visível na parte inferior da tela e o
  // assistente precisa subir pra não ficar coberto por ele nem cobri-lo
  // (prompt mestre, seção "AJUSTE IMPORTANTE"/"REGRAS DE UX IMPORTANTES").
  const consent = useSyncExternalStore(subscribeConsent, getStoredConsent, getServerConsentSnapshot);
  const liftForCookieBanner = consent === null;

  const [liveOverlay, setLiveOverlay] = useState<"greeting" | "open" | null>(null);
  const widgetState = liveOverlay ?? persistedWidgetState;

  useEffect(() => {
    trackAssistantEvent("assistant_viewed");
  }, []);

  // Saudação automática única por sessão (seção "IMPORTANTE SOBRE FREQUÊNCIA").
  // Reconfere `hasShownGreeting()` também no momento do disparo (não só ao
  // montar o efeito) - se o usuário já abriu o assistente manualmente
  // enquanto o timer ainda estava pendente, `handleOpen` já marcou a
  // saudação como mostrada e este callback não a exibe de novo.
  useEffect(() => {
    if (hasShownGreeting()) return;
    const timer = setTimeout(() => {
      if (hasShownGreeting()) return;
      markGreetingShown();
      setLiveOverlay((current) => (current === null ? "greeting" : current));
    }, GREETING_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function handleOpen() {
    setLiveOverlay("open");
    setStoredWidgetState("minimized");
    markGreetingShown();
    trackAssistantEvent("assistant_opened");
  }

  function handleClose() {
    setLiveOverlay(null);
    setStoredWidgetState("closed");
    setStoredScreen("menu");
    setStoredService(null);
    trackAssistantEvent("assistant_closed");
  }

  function handleMinimize() {
    setLiveOverlay(null);
    setStoredWidgetState("minimized");
  }

  function handleSelectService(key: AssistantServiceKey) {
    if (key === "especialista") {
      const link = getAssistantWhatsAppLink({ sourcePage: pathname });
      if (link) {
        trackAssistantEvent("assistant_whatsapp_clicked", { source: "menu" });
        window.open(link, "_blank", "noopener,noreferrer");
      }
      return;
    }
    setStoredService(key);
    setStoredScreen("service");
    trackAssistantEvent("assistant_service_selected", { service: key });
  }

  function handleNavigate(href: string) {
    trackAssistantEvent("assistant_route_clicked", { href });
    setLiveOverlay(null);
    setStoredWidgetState("minimized");
    router.push(href);
  }

  function handleStartLead() {
    setStoredScreen("lead");
    trackAssistantEvent("assistant_form_started", { service: selectedService ?? "outros" });
  }

  function handleLeadCompleted() {
    setStoredScreen("completed");
  }

  function handleBackToMenu() {
    setStoredScreen("menu");
    setStoredService(null);
  }

  const greetingMessage = getContextualGreeting(pathname ?? "/");

  if (widgetState === "open") {
    return (
      <AssistantPanel
        screen={screen}
        selectedService={selectedService}
        greetingMessage={greetingMessage}
        liftForCookieBanner={liftForCookieBanner}
        onSelectService={handleSelectService}
        onNavigate={handleNavigate}
        onStartLead={handleStartLead}
        onBackToMenu={handleBackToMenu}
        onLeadCompleted={handleLeadCompleted}
        onMinimize={handleMinimize}
        onClose={handleClose}
      />
    );
  }

  return (
    <AssistantLauncher
      showGreeting={widgetState === "greeting"}
      greetingMessage={greetingMessage}
      liftForCookieBanner={liftForCookieBanner}
      onOpen={handleOpen}
      onDismissGreeting={() => setLiveOverlay(null)}
    />
  );
}
