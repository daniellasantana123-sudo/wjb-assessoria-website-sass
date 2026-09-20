import { ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { OmieMapping } from "@/lib/omie-gclick";

/**
 * CTA "Ver no Portal Contábil" (Fase 4 do wjb-saas-mvp) — link externo
 * (nova aba), nunca um iframe embutido nem um SSO automático (o prompt
 * mestre proíbe ambos explicitamente): o cliente clica e faz login no
 * Omie.G-Click com as próprias credenciais lá, se existirem.
 *
 * Só aparece quando staff já configurou o link (`external_portal_url`) E
 * o mapeamento está ativo — nunca some um CTA quebrado nem aponta pra uma
 * integração desativada/com erro.
 */
export function OmiePortalCta({ mapping }: { mapping: OmieMapping | null }) {
  if (!mapping?.externalPortalUrl) return null;
  if (mapping.status !== "connected" && mapping.status !== "synced") return null;

  return (
    <a
      href={mapping.externalPortalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      Ver no Portal Contábil
      <ExternalLink className="size-4" aria-hidden="true" />
    </a>
  );
}
