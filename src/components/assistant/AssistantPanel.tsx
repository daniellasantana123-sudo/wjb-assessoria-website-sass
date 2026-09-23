import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { headerCtas } from "@/config/navigation";
import { assistantMenuOptions } from "@/lib/assistant/assistant-config";
import { getAssistantServiceResponse } from "@/lib/assistant/assistant-flow";
import { getAssistantWhatsAppLink } from "@/lib/assistant/whatsapp";
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
  const serviceResponse = selectedService
    ? getAssistantServiceResponse(selectedService)
    : null;
  /*
   * Só o serviço escolhido entra aqui - nome/telefone/e-mail vivem apenas
   * no estado em memória de `AssistantLeadForm` e nunca podem vazar pra
   * uma URL guardada em outro componente (regra de LGPD do projeto).
   */
  const completedWhatsAppLink = getAssistantWhatsAppLink({
    service: serviceResponse?.serviceLabel ?? undefined,
  });

  return (
    <div
      role="dialog"
      aria-label="Dani, assistente virtual da WJB"
      className={cn(
        "border-border bg-background animate-enter fixed inset-x-3 z-50 flex flex-col overflow-hidden rounded-md border shadow-xl transition-[bottom] duration-300 sm:inset-x-auto sm:right-6 sm:w-95",
        /*
         * `max-h` calculado por `calc(100dvh - <offset do bottom + folga>)`
         * (2026-09-22, bug real achado testando responsivo em telas curtas)
         * - o `min(600px,88dvh)` fixo de antes não considerava que
         * `liftForCookieBanner` muda o `bottom-*` pra bem mais longe da
         * borda (176px no mobile, contra 12px normal) - num viewport curto
         * (ex.: 320x568, iPhone SE, banner de cookies ainda visível na
         * primeira visita), 88dvh de altura + esse deslocamento maior
         * jogava o topo do painel pra fora da tela (`y` negativo,
         * cabeçalho/botão de fechar inacessíveis). Subtrair o offset exato
         * de cada combinação breakpoint/estado garante `top >= 0` por
         * construção, pra qualquer altura de viewport - não é uma
         * porcentagem que só funciona nos tamanhos testados.
         */
        liftForCookieBanner
          ? "bottom-44 max-h-[min(600px,calc(100dvh-12.5rem))] sm:bottom-40 sm:max-h-[min(600px,calc(100dvh-11rem))]"
          : "bottom-3 max-h-[min(600px,calc(100dvh-2rem))] sm:bottom-24 sm:max-h-[min(600px,calc(100dvh-7rem))]",
      )}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <AssistantHeader onMinimize={onMinimize} onClose={onClose} />

      {/*
       * `min-h-0 flex-1` é necessário pro `overflow-y-auto` funcionar de
       * verdade dentro de um pai flex-col com altura máxima (`max-h-*` +
       * `overflow-hidden` no dialog) - sem isso, o item flex recusa encolher
       * abaixo da altura do seu próprio conteúdo (o "min-height: auto"
       * padrão de flexbox) e o painel simplesmente cresce além do limite,
       * cortando o rodapé ("Falar direto com um especialista") em vez de
       * rolar - bug real, mais visível agora que o menu tem mais itens.
       */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {screen === "menu" ? (
          <>
            <AssistantMessage>{greetingMessage}</AssistantMessage>
            <AssistantMessage>
              Sou a Dani, assistente virtual da WJB. Estou aqui para ajudar você
              a encontrar o serviço ideal para sua empresa ou te encaminhar
              direto para um especialista. O que você precisa hoje?
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
              Perfeito! Me conta alguns dados rápidos para que a WJB entre em
              contato.
            </AssistantMessage>
            <AssistantLeadForm
              serviceLabel={serviceResponse?.serviceLabel ?? null}
              onSuccess={onLeadCompleted}
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

        {screen === "completed" ? (
          <>
            {/*
             * Texto e link revisados em 2026-09-23. O anterior afirmava
             * "recebemos seus dados", o que nem sempre é verdade (se
             * `/api/leads` falhou, o encaminhamento acontece só pelo
             * WhatsApp) - e o `window.open` roda depois de um `await`, o
             * que faz bloqueador de pop-up barrar a aba em vários
             * navegadores mobile. O link visível abaixo é a saída pra esses
             * dois casos: sempre dá pra concluir a conversa manualmente.
             */}
            <AssistantMessage>
              Pronto! Abrimos o WhatsApp com o resumo da sua conversa. Se a
              janela não tiver aberto, use o botão abaixo.
            </AssistantMessage>
            {completedWhatsAppLink ? (
              <a
                href={completedWhatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "self-start",
                })}
              >
                Abrir o WhatsApp
              </a>
            ) : null}
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

      <div className="border-border shrink-0 border-t p-3">
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
