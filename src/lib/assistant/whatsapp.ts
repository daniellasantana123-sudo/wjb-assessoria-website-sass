import { getWhatsAppLink } from "@/integrations/whatsapp";
import type { AssistantLead } from "@/types/assistant";

/**
 * Mensagem contextual do WhatsApp (seção "MENSAGEM CONTEXTUAL DO WHATSAPP")
 * - reaproveita `getWhatsAppLink` (mesmo número/integração do resto do
 * site, seção "WHATSAPP"). Campos não informados são omitidos, nunca
 * enviados como vazio/"undefined".
 */
export function buildAssistantWhatsAppMessage(lead: AssistantLead): string {
  const lines = ["Olá, equipe WJB!", "", "Estou entrando em contato pela Bia, a assistente virtual do site."];

  if (lead.name) lines.push("", `Nome: ${lead.name}`);
  if (lead.service) lines.push(`Serviço desejado: ${lead.service}`);
  if (lead.companyStatus) lines.push(`Situação da empresa: ${lead.companyStatus}`);
  if (lead.taxRegime) lines.push(`Regime tributário: ${lead.taxRegime}`);
  if (lead.revenueRange) lines.push(`Faturamento aproximado: ${lead.revenueRange}`);
  if (lead.employees) lines.push(`Funcionários: ${lead.employees}`);
  if (lead.sourcePage) lines.push(`Página de origem: ${lead.sourcePage}`);

  lines.push("", "Gostaria de receber mais informações.");
  return lines.join("\n");
}

export function getAssistantWhatsAppLink(lead: AssistantLead) {
  return getWhatsAppLink(buildAssistantWhatsAppMessage(lead));
}
