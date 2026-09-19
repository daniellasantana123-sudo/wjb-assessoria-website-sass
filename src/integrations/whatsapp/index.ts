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
