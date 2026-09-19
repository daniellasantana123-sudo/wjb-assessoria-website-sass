"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  getServerConsentSnapshot,
  getStoredConsent,
  storeConsent,
  subscribeConsent,
  type ConsentChoice,
} from "@/lib/consent/cookie-consent";

export function CookieConsentBanner() {
  const consent = useSyncExternalStore(
    subscribeConsent,
    getStoredConsent,
    getServerConsentSnapshot,
  );

  if (consent !== null) return null;

  function handleChoice(choice: ConsentChoice) {
    storeConsent(choice);
  }

  return (
    <div
      role="region"
      aria-label="Consentimento de cookies"
      className="animate-slide-up border-border bg-background fixed inset-x-0 bottom-0 z-40 border-t shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-4 sm:flex-row sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Utilizamos cookies essenciais para o funcionamento do site e, com sua
          autorização, podemos utilizar tecnologias adicionais para melhorar a
          experiência e entender o uso das páginas. Veja nossa{" "}
          <Link href="/cookies" className="text-primary underline underline-offset-2">
            Política de Cookies
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => handleChoice("declined")}>
            Rejeitar não essenciais
          </Button>
          <Button size="sm" onClick={() => handleChoice("accepted")}>
            Aceitar todos
          </Button>
        </div>
      </div>
    </div>
  );
}
