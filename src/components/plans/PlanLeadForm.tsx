"use client";

import { LeadForm } from "@/components/forms/lead-form";
import { Modal } from "@/components/shared/modal";
import { formatBRL } from "@/config/pricing";
import type { Plan } from "@/config/plans";
import { getWhatsAppLink } from "@/integrations/whatsapp";
import { trackPlanEvent } from "@/lib/analytics/plan-events";
import { describeSimulation } from "@/lib/simulator/format";
import type { PriceEstimate, SimulationState } from "@/types/pricing";

export interface PlanLeadFormProps {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  state: SimulationState;
  estimate: PriceEstimate;
}

/**
 * Modal de contratação do simulador (seção 19) — reaproveita o LeadForm e o
 * endpoint /api/leads já existentes (mesmo padrão validado no resto do
 * site), com a mensagem pré-preenchida com o resumo da simulação. Como
 * ainda não há CRM/backend comercial confirmado (seção 36), ao enviar
 * também abre o WhatsApp da WJB com o mesmo resumo (seção 19, "se ainda não
 * houver backend comercial").
 */
export function PlanLeadForm({ open, onClose, plan, state, estimate }: PlanLeadFormProps) {
  const lines = describeSimulation(state, plan.name);

  const summaryMessage = estimate.requiresCustomQuote
    ? [
        "Olá, equipe WJB. Fiz uma simulação no site e o sistema indicou que meu caso precisa",
        "de uma proposta personalizada. Gostaria de conversar com um especialista.",
        "",
        ...lines.map((line) => `${line.label}: ${line.value}`),
      ].join("\n")
    : [
        "Olá, equipe WJB. Fiz uma simulação no site e gostaria de conversar sobre minha",
        "empresa.",
        "",
        ...lines.map((line) => `${line.label}: ${line.value}`),
        `Estimativa apresentada: ${formatBRL(estimate.amount)}/mês`,
      ].join("\n");

  function handleSuccess() {
    trackPlanEvent("plan_lead_click", { regime: plan.id });
    const whatsappLink = getWhatsAppLink(summaryMessage);
    if (whatsappLink) {
      trackPlanEvent("plan_whatsapp_click", { regime: plan.id });
      window.open(whatsappLink, "_blank", "noopener,noreferrer");
    }
  }

  const title = estimate.requiresCustomQuote
    ? "Solicitar proposta personalizada"
    : `Contratar ${plan.name}`;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-muted-foreground mb-4 text-sm">
        Envie seus dados com o resumo da simulação. A WJB entra em contato para validar as
        informações e, em seguida, abrimos o WhatsApp com o resumo já preenchido.
      </p>
      <LeadForm
        formContext={`Simulador de Planos - ${plan.name}`}
        defaultServiceInterest={`Plano ${plan.name}`}
        defaultMessage={summaryMessage}
        showServiceInterest={false}
        submitLabel="Enviar e abrir WhatsApp"
        onSuccess={handleSuccess}
      />
    </Modal>
  );
}
