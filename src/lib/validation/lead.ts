import { z } from "zod";

/**
 * Origem do lead. Os campos de 2026-11-09 (termo, conteúdo, gclid, página de
 * entrada) são opcionais para quem ainda envia o formato antigo.
 */
const optionalTrackingField = z.string().max(300).nullable().optional();
const trackingSchema = z.object({
  sourcePath: z.string(),
  utmSource: z.string().nullable(),
  utmMedium: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  utmTerm: optionalTrackingField,
  utmContent: optionalTrackingField,
  gclid: optionalTrackingField,
  landingPage: optionalTrackingField,
});

/**
 * Schema compartilhado por todos os formulários de lead (contato, proposta,
 * abrir empresa, trocar de contador, diagnóstico, newsletter) — seção 19.
 * Validado no cliente (react-hook-form) e no servidor (route handler).
 */
export const leadFormSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  phone: z.string().trim().min(8, "Informe um WhatsApp válido."),
  company: z.string().trim().optional().or(z.literal("")),
  cnpj: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  businessActivity: z.string().trim().optional().or(z.literal("")),
  serviceInterest: z.string().trim().min(1, "Selecione um assunto."),
  // Opcional desde 2026-11-09: no primeiro contato, nome, WhatsApp, e-mail e
  // serviço bastam; exigir texto livre só afastava quem queria ser atendido.
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  consent: z.boolean().refine((value) => value, {
    message: "É necessário concordar com o uso dos dados para enviar.",
  }),
  formContext: z.string(),
  tracking: trackingSchema,
  /** Identificador do envio, gerado no navegador: evita gravar o mesmo lead duas vezes. */
  submissionId: z.string().uuid().optional(),
  /** Campo-armadilha invisível: pessoas não preenchem, robôs costumam preencher. */
  website: z.string().max(200).optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const newsletterFormSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  tracking: trackingSchema,
});

export type NewsletterFormValues = z.infer<typeof newsletterFormSchema>;

/** Popup "Antes de sair" (2026-10-01): versão curta do lead, sem mensagem livre. */
export const exitIntentLeadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  phone: z.string().trim().min(8, "Informe um WhatsApp válido."),
  email: z.string().trim().email("Informe um e-mail válido."),
  company: z.string().trim().optional(),
  serviceInterest: z.string().trim().min(1, "Escolha um assunto."),
  consent: z.boolean().refine((value) => value, {
    message: "É necessário concordar com o uso dos dados para enviar.",
  }),
});

export type ExitIntentLeadValues = z.infer<typeof exitIntentLeadSchema>;
