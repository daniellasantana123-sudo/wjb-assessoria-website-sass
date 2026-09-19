import { z } from "zod";

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
  message: z.string().trim().min(10, "Conte um pouco mais (mínimo 10 caracteres)."),
  consent: z.boolean().refine((value) => value, {
    message: "É necessário concordar com o uso dos dados para enviar.",
  }),
  formContext: z.string(),
  tracking: z.object({
    sourcePath: z.string(),
    utmSource: z.string().nullable(),
    utmMedium: z.string().nullable(),
    utmCampaign: z.string().nullable(),
  }),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const newsletterFormSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  tracking: z.object({
    sourcePath: z.string(),
    utmSource: z.string().nullable(),
    utmMedium: z.string().nullable(),
    utmCampaign: z.string().nullable(),
  }),
});

export type NewsletterFormValues = z.infer<typeof newsletterFormSchema>;
