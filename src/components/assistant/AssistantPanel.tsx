import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { headerCtas } from "@/config/navigation";
import { assistantMenuOptions } from "@/lib/assistant/assistant-config";
import { getAssistantServiceResponse } from "@/lib/assistant/assistant-flow";
import { cn } from "@/lib/utils";
import type { AssistantScreen, AssistantServiceKey } from "@/types/assistant";

import { AssistantHeader } from "./AssistantHeader";
import { AssistantLeadForm } from "./AssistantLeadForm";
import { AssistantMessage } from "./AssistantMessage";
import { AssistantQuickReplies } from "./AssistantQuickReplies";

export interface AssistantPanelProps {
  screen: AssistantScreen;
  selectedService: AssistantServiceKey | null;
  greetingMessage: string;
  /** Sobe o painel pra não ficar sob o banner de cookies enquanto ele existir. */
  liftForCookieBanner: boolean;
  onSelectService: (key: AssistantServiceKey) => void;
  onNavigate: (href: string) => void;
  onStartLead: () => void;
  onBackToMenu: () => void;
  onLeadCompleted: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

/**
 * Painel do assistente (seção "JANELA DO ASSISTENTE"). Fluxo determinístico
 * (sem IA generativa, seção "MOTOR DE CONVERSAÇÃO"): menu -> resposta do
 * serviço -> qualificação opcional -> conclusão. O CTA "Falar direto com um
 * especialista" (seção "ESCAPE HATCH") fica sempre visível no rodapé, em
 * qualquer tela, pra o usuário nunca ficar preso no fluxo automatizado.
 */
export function AssistantPanel({
  screen,
  selectedService,
  greetingMessage,
  liftForCookieBanner,
  onSelectService,
  onNavigate,
  onStartLead,
  onBackToMenu,
  onLeadCompleted,
  onMinimize,
  onClose,
}: AssistantPanelProps) {
  const serviceResponse = selectedService ? getAssistantServiceResponse(selectedService) : null;

  return (
    <div
      role="dialog"
      aria-label="Assistente WJB"
      className={cn(
        "border-border bg-background animate-enter fixed inset-x-3 z-50 flex max-h-[600px] flex-col overflow-hidden rounded-md border shadow-xl transition-[bottom] duration-300 sm:inset-x-auto sm:right-6 sm:w-[360px]",
        liftForCookieBanner ? "bottom-44 sm:bottom-40" : "bottom-3 sm:bottom-24",
      )}
    >
      <AssistantHeader onMinimize={onMinimize} onClose={onClose} />

      <div className="flex flex-col gap-3 overflow-y-auto p-4">
        {screen === "menu" ? (
          <>
            <AssistantMessage>{greetingMessage}</AssistantMessage>
            <AssistantMessage>
              Estou aqui para ajudar você a encontrar o serviço ideal para sua empresa. O que
              você precisa hoje?
            </AssistantMessage>
            <AssistantQuickReplies
              options={assistantMenuOptions.map((option) => ({
                label: option.label,
                onClick: () => onSelectService(option.key),
              }))}
            />
          </>
        ) : null}

        {screen === "service" && serviceResponse ? (
          <>
            <AssistantMessage>{serviceResponse.message}</AssistantMessage>
            <AssistantQuickReplies
              options={[
                ...(serviceResponse.href
                  ? [
                      {
                        label: "Conhecer o serviço",
                        onClick: () => onNavigate(serviceResponse.href!),
                      },
                    ]
                  : []),
                { label: "Solicitar atendimento", onClick: onStartLead },
              ]}
            />
            <button
              type="button"
              onClick={onBackToMenu}
              className="text-primary self-start text-xs font-medium hover:underline"
            >
              Voltar ao menu
            </button>
          </>
        ) : null}

        {screen === "lead" ? (
          <>
            <AssistantMessage>
              Perfeito! Me conta alguns dados rápidos que a WJB entra em contato.
            </AssistantMessage>
            <AssistantLeadForm serviceLabel={serviceResponse?.serviceLabel ?? null} onSuccess={onLeadCompleted} />
            <button
              type="button"
              onClick={onBackToMenu}
              className="text-primary self-start text-xs font-medium hover:underline"
            >
              Voltar ao menu
            </button>
          </>
        ) : null}

        {screen === "completed" ? (
          <>
            <AssistantMessage>
              Obrigado! Recebemos seus dados e abrimos o WhatsApp com o resumo da conversa.
              Nossa equipe entra em contato em breve.
            </AssistantMessage>
            <button
              type="button"
              onClick={onBackToMenu}
              className="text-primary self-start text-xs font-medium hover:underline"
            >
              Voltar ao menu
            </button>
          </>
        ) : null}
      </div>

      <div className="border-border mt-auto border-t p-3">
        <Link
          href={headerCtas.talkToAccountant.href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "cta", className: "w-full" })}
        >
          Falar direto com um especialista
        </Link>
      </div>
    </div>
  );
}
