import { ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { GCLICK_CLIENT_PORTAL_URL } from "@/integrations/omie-gclick";
import type { OmieMapping } from "@/lib/omie-gclick";

/**
 * CTA "Ver no Portal Contábil" (Fase 4 do wjb-saas-mvp, corrigido na Fase
 * 6.5) - link externo (nova aba), nunca um iframe embutido nem um SSO
 * automático (o prompt mestre proíbe ambos explicitamente): o cliente
 * clica e faz login no G-Click com as próprias credenciais lá.
 *
 * Aponta pro link específico do tenant (`external_portal_url`, caso staff
 * tenha configurado um domínio próprio/personalizado) ou, na ausência
 * dele, pra URL real e fixa do login do Portal Visão do Cliente
 * (`GCLICK_CLIENT_PORTAL_URL`, confirmada via documentação oficial na
 * Fase 6.5 - é a MESMA pra qualquer empresa, nunca uma URL exclusiva por
 * cliente, então nunca depender de staff preencher esse campo pra o CTA
 * aparecer).
 *
 * Só aparece quando o mapeamento está `connected`/`synced` (staff
 * confirmou que a empresa tem conta no G-Click) - nunca some um CTA pra
 * uma integração desativada/com erro. `featureEnabled` (Fase 5) é o kill
 * switch global - some mesmo que o mapeamento individual esteja ok.
 */
export function OmiePortalCta({
  mapping,
  featureEnabled,
}: {
  mapping: OmieMapping | null;
  featureEnabled: boolean;
}) {
  if (!featureEnabled) return null;
  if (!mapping) return null;
  if (mapping.status !== "connected" && mapping.status !== "synced") return null;

  const href = mapping.externalPortalUrl || GCLICK_CLIENT_PORTAL_URL;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      Ver no Portal Contábil
      <ExternalLink className="size-4" aria-hidden="true" />
    </a>
  );
}
