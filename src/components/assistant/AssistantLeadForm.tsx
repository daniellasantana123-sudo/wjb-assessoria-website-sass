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
 * "FORMULÁRIOS"). Ao enviar, abre o WhatsApp da WJB com o contexto já
 * coletado.
 *
 * **Abre o WhatsApp mesmo quando o envio falha** (2026-09-23, bug real
 * reportado pelo usuário com print): antes, um erro em `/api/leads` (em
 * produção, 500 por falta das credenciais de Supabase) parava tudo no
 * "Não foi possível enviar agora" - a pessoa preenchia nome, WhatsApp e
 * e-mail e não chegava a lugar nenhum. O propósito do assistente é ligar o
 * visitante à WJB, e o WhatsApp leva os mesmos dados na mensagem, então
 * uma falha de gravação nossa nunca deve bloquear esse encaminhamento.
 */
export function AssistantLeadForm({
  serviceLabel,
  onSuccess,
}: AssistantLeadFormProps) {
  const pathname = usePathname();
  const defaultMessage = serviceLabel
    ? `Gostaria de falar sobre: ${serviceLabel}.`
    : "";

  function openWhatsApp(source: "lead_form" | "lead_form_fallback") {
    const whatsappLink = getAssistantWhatsAppLink({
      service: serviceLabel ?? undefined,
      sourcePage: pathname ?? undefined,
    });
    if (!whatsappLink) return;
    trackAssistantEvent("assistant_whatsapp_clicked", { source });
    window.open(whatsappLink, "_blank", "noopener,noreferrer");
  }

  function handleSuccess() {
    trackAssistantEvent("assistant_form_completed", {
      service: serviceLabel ?? "outros",
    });
    openWhatsApp("lead_form");
    onSuccess();
  }

  function handleError() {
    openWhatsApp("lead_form_fallback");
    onSuccess();
  }

  return (
    <LeadForm
      formContext="Assistente Virtual WJB (Daniella)"
      defaultServiceInterest={serviceLabel ?? undefined}
      defaultMessage={defaultMessage}
      showServiceInterest={false}
      showCompany={false}
      submitLabel="Enviar e abrir WhatsApp"
      onSuccess={handleSuccess}
      onError={handleError}
    />
  );
}
