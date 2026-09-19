import Image from "next/image";

import { assistantAvatar } from "@/config/images";

export interface AssistantMessageProps {
  children: React.ReactNode;
}

/** Bolha de mensagem do assistente (avatar pequeno + texto). */
export function AssistantMessage({ children }: AssistantMessageProps) {
  return (
    <div className="flex items-start gap-2">
      <Image
        src={assistantAvatar.src}
        alt=""
        width={28}
        height={28}
        className="mt-0.5 h-7 w-7 shrink-0 rounded-full"
      />
      <div className="bg-muted text-foreground max-w-[85%] rounded-md px-3 py-2 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}
