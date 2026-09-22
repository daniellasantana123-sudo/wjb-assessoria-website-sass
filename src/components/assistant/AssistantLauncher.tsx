import Image from "next/image";
import { X } from "lucide-react";

import { assistantAvatar } from "@/config/images";
import { cn } from "@/lib/utils";

export interface AssistantLauncherProps {
  showGreeting: boolean;
  greetingMessage: string;
  /** Sobe o avatar pra não ficar sob o banner de cookies enquanto ele existir. */
  liftForCookieBanner: boolean;
  onOpen: () => void;
  onDismissGreeting: () => void;
}

/**
 * Avatar flutuante (seção "BOTÃO FLUTUANTE"/"COMPORTAMENTO INICIAL") - só o
 * avatar ao carregar a página; depois de alguns segundos (controlado pelo
 * orquestrador), o balão de saudação aparece ao lado. Em mobile não depende
 * de hover (seção "MOBILE").
 */
export function AssistantLauncher({
  showGreeting,
  greetingMessage,
  liftForCookieBanner,
  onOpen,
  onDismissGreeting,
}: AssistantLauncherProps) {
  return (
    <div
      className={cn(
        "fixed right-6 z-50 flex flex-col items-end gap-3 transition-[bottom] duration-300",
        liftForCookieBanner ? "bottom-44 sm:bottom-24" : "bottom-6",
      )}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {showGreeting ? (
        <div className="animate-enter border-border bg-background relative w-72 max-w-[calc(100vw-3rem)] rounded-md border p-4 shadow-lg">
          <button
            type="button"
            onClick={onDismissGreeting}
            aria-label="Fechar saudação"
            className="text-muted-foreground hover:text-foreground absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <p className="text-foreground pr-6 text-xs font-semibold">
            Daniella · WJB Assessoria Contábil
          </p>
          <p className="text-foreground mt-1 pr-4 text-sm">{greetingMessage}</p>
          <button
            type="button"
            onClick={onOpen}
            className="text-primary mt-2 text-sm font-medium hover:underline"
          >
            Falar com a Daniella
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        aria-label="Abrir Assistente Virtual WJB"
        className="group focus-visible:ring-primary relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Image
          src={assistantAvatar.src}
          alt={assistantAvatar.alt}
          width={56}
          height={56}
          className="assistant-avatar-breathe h-14 w-14 rounded-full"
        />
        <span
          aria-hidden="true"
          className="border-background bg-success absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full border-2"
        />
        <span className="pointer-events-none absolute right-full mr-3 hidden rounded-md bg-neutral-900 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100 sm:block">
          Fale com a Daniella 💬
        </span>
      </button>
    </div>
  );
}
