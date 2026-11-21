import { siteConfig } from "@/config/site";

const DEFAULT_MESSAGE = "Olá! Gostaria de falar com um contador da WJB Assessoria Contábil.";
const ARMELX_DEFAULT_MESSAGE =
  "Olá! Vim pelo site da WJB e gostaria de conversar sobre uma solução com a Armel-x Tecnologia.";

function buildWhatsAppLink(e164: string, message: string) {
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

/**
 * Monta o link wa.me de um dos WhatsApp da WJB (índice 0 = principal,
 * usado no CTA "Falar com contador"). Seção 36/37 — sem API oficial do
 * WhatsApp Business ainda, então é só um link wa.me com mensagem
 * pré-preenchida.
 */
export function getWhatsAppLink(message: string = DEFAULT_MESSAGE, phoneIndex = 0) {
  const phone = siteConfig.contact.phones[phoneIndex];
  if (!phone) return null;
  return buildWhatsAppLink(phone.e164, message);
}

/**
 * WhatsApp da Armel-x Tecnologia (parceira de tecnologia, não é a WJB) —
 * usado no CTA "Conversar sobre uma solução" de /armel-x-tecnologia
 * (2026-08-31, número fornecido pelo usuário).
 */
export function getArmelxWhatsAppLink(message: string = ARMELX_DEFAULT_MESSAGE) {
  const phone = siteConfig.partners.armelx.whatsapp;
  if (!phone) return null;
  return buildWhatsAppLink(phone.e164, message);
}

/**
 * Link de contato direto por plano (2026-09-21) — substitui o simulador de
 * honorários (removido a pedido do usuário): em vez de simular, os CTAs de
 * `/planos` levam direto pro WhatsApp com o nome do plano já na mensagem.
 * Mensagem montada a partir de `plan.name` (nunca duplicada como string
 * fixa por plano) pra nunca ficar dessincronizada do nome real do plano.
 */
export function getPlanWhatsAppLink(planName: string) {
  return getWhatsAppLink(
    `Olá! Tenho interesse no plano ${planName} da WJB Assessoria Contábil.`,
  );
}

/**
 * Click-to-Chat comercial da emissão de notas (Fase 9, 21/11/2026).
 *
 * O link (`wa.me`) SÓ abre uma conversa com o número oficial da WJB e deixa
 * uma mensagem pronta: o cliente precisa confirmar o envio no próprio
 * WhatsApp. Não é a API de mensagens do WhatsApp: não há webhook, leitura,
 * confirmação de entrega nem envio automático.
 *
 * A função só aceita uma INTENÇÃO da lista fechada abaixo, nunca texto livre:
 * assim nenhum dado de cadastro, CPF/CNPJ, valor ou dado fiscal pode entrar
 * no link por engano.
 */
export const commercialWhatsAppMessages = {
  mei: "Olá! Tenho interesse no plano MEI Digital da WJB. Gostaria de receber orientações.",
  somenteEmissao: "Olá! Gostaria de contratar somente o serviço de emissão de NFS-e da WJB.",
  combo: "Olá! Tenho interesse em Contabilidade Completa + Emissão de NFS-e.",
  altoVolume: "Olá! Gostaria de solicitar proposta para emissão de NFS-e em alto volume.",
  contabilidade: "Olá! Gostaria de falar com um contador da WJB Assessoria Contábil.",
  duvidaEmissao: "Olá! Tenho uma dúvida sobre o serviço de emissão de NFS-e da WJB.",
} as const;
export type CommercialWhatsAppIntent = keyof typeof commercialWhatsAppMessages;

export function getCommercialWhatsAppLink(intent: CommercialWhatsAppIntent) {
  return getWhatsAppLink(commercialWhatsAppMessages[intent]);
}

/** Texto curto que acompanha os botões de WhatsApp (expectativa correta). */
export const whatsAppClickToChatNotice =
  "Abre o WhatsApp com uma mensagem pronta. Nada é enviado até você tocar em enviar.";

/** Números exibidos ao público como WhatsApp (só o oficial; ver `publicWhatsApp` em site.ts). */
export function getPublicWhatsAppPhones() {
  return siteConfig.contact.phones.filter((p) => p.publicWhatsApp);
}
