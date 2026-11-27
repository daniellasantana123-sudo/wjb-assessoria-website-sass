"use client";

import { useId, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { getCommercialWhatsAppLink, whatsAppClickToChatNotice } from "@/integrations/whatsapp";
import { trackAssistantEvent } from "@/lib/analytics/assistant-events";
import {
  classifyCommercialText,
  COMMERCIAL_QUESTIONS,
  commercialAnswer,
  nextCommercial,
  type CommercialCatalog,
  type CommercialIntent,
  type CommercialStep,
} from "@/lib/assistant/commercial-flow";

import { AssistantMessage } from "./AssistantMessage";
import { AssistantQuickReplies } from "./AssistantQuickReplies";

export interface AssistantCommercialProps {
  catalog: CommercialCatalog | null;
  onNavigate: (href: string) => void;
  onBackToMenu: () => void;
}

/**
 * Atendimento comercial da emissão de notas dentro do chat do site (Fase 9).
 * Não é bot de WhatsApp: os botões de WhatsApp só abrem uma conversa com
 * mensagem pronta (Click-to-Chat). O texto digitado fica só nesta tela.
 */
export function AssistantCommercial({ catalog, onNavigate, onBackToMenu }: AssistantCommercialProps) {
  const [step, setStep] = useState<CommercialStep>("inicio");
  const [intent, setIntent] = useState<CommercialIntent | null>(null);
  const [text, setText] = useState("");
  const [notUnderstood, setNotUnderstood] = useState(false);
  const inputId = useId();

  function choose(next: CommercialIntent) {
    setIntent(next);
    setNotUnderstood(false);
    trackAssistantEvent("assistant_service_selected", { service: `nfse_${next}` });
  }

  if (intent) {
    const answer = commercialAnswer(intent, catalog);
    return (
      <>
        <AssistantMessage>{answer.message}</AssistantMessage>
        <div className="flex flex-col gap-2">
          {answer.actions.map((a) =>
            a.kind === "route" ? (
              <button
                key={a.label}
                type="button"
                onClick={() => onNavigate(a.href)}
                className="border-border hover:border-primary hover:bg-muted focus-visible:ring-primary min-h-11 rounded-md border px-3.5 py-2.5 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {a.label}
              </button>
            ) : (
              <a
                key={a.label}
                href={getCommercialWhatsAppLink(a.intent) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                data-analytics-location="assistente-emissao"
                className={buttonVariants({ variant: "outline", className: "min-h-11 justify-start text-left whitespace-normal" })}
              >
                {a.label}
                <span className="sr-only"> (abre o WhatsApp em nova aba)</span>
              </a>
            ),
          )}
        </div>
        {answer.actions.some((a) => a.kind === "whatsapp") ? <p className="text-muted-foreground text-xs">{whatsAppClickToChatNotice}</p> : null}
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => { setIntent(null); setStep("inicio"); }} className="text-primary text-xs font-medium hover:underline">
            Ver outras opções
          </button>
          <button type="button" onClick={onBackToMenu} className="text-primary text-xs font-medium hover:underline">
            Voltar ao menu
          </button>
        </div>
      </>
    );
  }

  const q = COMMERCIAL_QUESTIONS[step];
  return (
    <>
      <AssistantMessage>{q.message}</AssistantMessage>
      <AssistantQuickReplies
        options={q.choices.map((c) => ({
          label: c.label,
          onClick: () => {
            const next = nextCommercial(step, c.id);
            if (!next) return;
            if ("step" in next) setStep(next.step);
            else choose(next.intent);
          },
        }))}
      />
      {step === "inicio" ? (
        <form
          method="post"
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const found = classifyCommercialText(text);
            setText("");
            if (found) choose(found);
            else setNotUnderstood(true);
          }}
        >
          <label htmlFor={inputId} className="text-muted-foreground text-xs">Ou escreva em poucas palavras</label>
          <div className="flex gap-2">
            <input
              id={inputId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              autoComplete="off"
              placeholder="Ex.: sou MEI e emito poucas notas"
              className="border-border bg-background focus-visible:ring-primary min-h-11 min-w-0 flex-1 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
            <button type="submit" className={buttonVariants({ variant: "outline", className: "min-h-11" })}>Enviar</button>
          </div>
          <p className="text-muted-foreground text-xs">Não escreva CPF, CNPJ ou dados de notas aqui.</p>
          {notUnderstood ? (
            <p role="status" className="text-sm">Não entendi. Escolha uma das opções acima ou fale com a equipe.</p>
          ) : null}
        </form>
      ) : null}
      <button type="button" onClick={onBackToMenu} className="text-primary self-start text-xs font-medium hover:underline">
        Voltar ao menu
      </button>
    </>
  );
}
