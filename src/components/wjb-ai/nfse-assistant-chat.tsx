"use client";

import { useRef, useState, useTransition } from "react";

import { conversationTurnAction } from "@/actions/wjb-ai-conversation";
import { submitNfseAction } from "@/actions/wjb-ai-fiscal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialState,
  type ConversationState,
} from "@/lib/wjb-ai/conversation/engine";

interface Msg {
  from: "cliente" | "assistente";
  text: string;
}

/**
 * Chat interno de homologação (Fase 7). O estado da conversa (inclusive os
 * dados do tomador) fica só em memória nesta tela; nada é gravado no
 * navegador. Ao confirmar, o pedido é criado pelo mesmo `submitNfseAction`
 * do formulário, que revalida tudo no servidor.
 */
export function NfseAssistantChat({ tenantId }: { tenantId: string }) {
  const [state, setState] = useState<ConversationState>(initialState());
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: "assistente",
      text: "Olá! Sou o assistente da WJB (simulação, sem IA). Posso registrar um pedido de NFS-e de serviço. O que você precisa?",
    },
  ]);
  const [quick, setQuick] = useState<string[]>(["Quero pedir uma nota"]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function send(message: string) {
    if (!message.trim() || pending) return;
    setError(null);
    setMessages((m) => [...m, { from: "cliente", text: message }]);
    setText("");
    start(async () => {
      const r = await conversationTurnAction(state, message);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setState(r.state);
      setQuick(r.quickReplies);
      setMessages((m) => [...m, { from: "assistente", text: r.reply }]);
      if (r.ready) {
        const fd = new FormData();
        fd.set("expectedTenantId", tenantId);
        fd.set("serviceDescription", r.state.values.serviceDescription);
        fd.set("grossAmount", r.state.values.grossAmount.replace(".", ","));
        fd.set("competence", r.state.values.competence);
        fd.set("takerDocument", r.state.values.takerDocument);
        fd.set("takerName", r.state.values.takerName);
        fd.set("takerEmail", r.state.values.takerEmail);
        fd.set("sourceReference", "assistente");
        // Redireciona para o pedido em caso de sucesso; se o servidor recusar, mostra o motivo.
        const res = await submitNfseAction(undefined, fd);
        if (res?.error) setError(`Não consegui registrar: ${res.error}`);
      }
      inputRef.current?.focus();
    });
  }

  const closed = state.stage === "pronto" || state.stage === "encaminhado";
  return (
    <div className="flex flex-col gap-4">
      <ol
        aria-live="polite"
        aria-label="Conversa com o assistente"
        className="border-border flex max-h-[28rem] flex-col gap-3 overflow-y-auto rounded-md border p-4"
      >
        {messages.map((m, i) => (
          <li
            key={i}
            className={m.from === "cliente" ? "self-end" : "self-start"}
          >
            <span className="sr-only">
              {m.from === "cliente" ? "Você:" : "Assistente:"}{" "}
            </span>
            <p
              className={`max-w-prose rounded-md px-3 py-2 text-sm break-words whitespace-pre-line ${m.from === "cliente" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground"}`}
            >
              {m.text}
            </p>
          </li>
        ))}
        {pending ? (
          <li className="text-muted-foreground self-start text-sm">
            Pensando...
          </li>
        ) : null}
      </ol>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      {quick.length && !closed ? (
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <Button
              key={q}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => send(q)}
              disabled={pending}
            >
              {q}
            </Button>
          ))}
        </div>
      ) : null}
      {!closed ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="msg">Sua mensagem</Label>
            <Input
              id="msg"
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={pending || !text.trim()}>
            Enviar
          </Button>
        </form>
      ) : state.stage === "encaminhado" ? (
        <p className="text-muted-foreground text-sm">
          Conversa encaminhada à equipe da WJB.
        </p>
      ) : null}
    </div>
  );
}
