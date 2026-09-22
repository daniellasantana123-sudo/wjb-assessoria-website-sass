"use client";

import { usePathname } from "next/navigation";

import { LeadForm } from "@/components/forms/lead-form";
import { trackAssistantEvent } from "@/lib/analytics/assistant-events";
import { getAssistantWhatsAppLink } from "@/lib/assistant/whatsapp";

export interface AssistantLeadFormProps {
  serviceLabel: string | null;
  onSuccess: () => void;
}

/**
 * Formulário de qualificação do assistente - reaproveita o `LeadForm`
 * já existente em vez de criar uma estrutura de captura paralela (seção
 * "FORMULÁRIOS"). Ao enviar com sucesso, abre o WhatsApp da WJB com o
 * contexto já coletado.
 */
export function AssistantLeadForm({ serviceLabel, onSuccess }: AssistantLeadFormProps) {
  const pathname = usePathname();
  const defaultMessage = serviceLabel
    ? `Gostaria de falar sobre: ${serviceLabel}.`
    : "";

  function handleSuccess() {
    trackAssistantEvent("assistant_form_completed", {
      service: serviceLabel ?? "outros",
    });
    const whatsappLink = getAssistantWhatsAppLink({
      service: serviceLabel ?? undefined,
      sourcePage: pathname ?? undefined,
    });
    if (whatsappLink) {
      trackAssistantEvent("assistant_whatsapp_clicked", { source: "lead_form" });
      window.open(whatsappLink, "_blank", "noopener,noreferrer");
    }
    onSuccess();
  }

  return (
    <LeadForm
      formContext="Assistente Virtual WJB (Bia)"
      defaultServiceInterest={serviceLabel ?? undefined}
      defaultMessage={defaultMessage}
      showServiceInterest={false}
      showCompany={false}
      submitLabel="Enviar e abrir WhatsApp"
      onSuccess={handleSuccess}
    />
  );
}
