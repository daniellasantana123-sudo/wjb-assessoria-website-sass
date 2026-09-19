import Image from "next/image";
import { Minus, X } from "lucide-react";

import { assistantAvatar } from "@/config/images";

export interface AssistantHeaderProps {
  onMinimize: () => void;
  onClose: () => void;
}

/**
 * Cabeçalho do painel - avatar, título, indicador de atendimento (sem
 * afirmar "online agora", já que não existe regra de disponibilidade em
 * tempo real - seção "INDICADOR DE DISPONIBILIDADE") e os botões
 * minimizar/fechar.
 */
export function AssistantHeader({ onMinimize, onClose }: AssistantHeaderProps) {
  return (
    <div className="border-border bg-primary text-primary-foreground flex items-center justify-between gap-3 rounded-t-md border-b p-4">
      <div className="flex items-center gap-3">
        <Image
          src={assistantAvatar.src}
          alt={assistantAvatar.alt}
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full"
        />
        <div>
          <p className="text-sm font-semibold">Assistente WJB</p>
          <p className="text-primary-foreground/80 flex items-center gap-1 text-xs">
            <span aria-hidden="true">🟢</span> Atendimento WJB
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMinimize}
          aria-label="Minimizar assistente"
          className="hover:bg-primary-foreground/10 focus-visible:ring-primary-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Minus aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar assistente"
          className="hover:bg-primary-foreground/10 focus-visible:ring-primary-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
