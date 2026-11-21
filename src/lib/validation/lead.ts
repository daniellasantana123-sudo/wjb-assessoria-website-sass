import { z } from "zod";

/**
 * Origem do lead. Os campos de 2026-11-09 (termo, conteúdo, gclid, página de
 * entrada) são opcionais para quem ainda envia o formato antigo.
 */
const optionalTrackingField = z.string().max(300).nullable().optional();
const trackingSchema = z.object({
  sourcePath: z.string().max(300),
  utmSource: z.string().max(300).nullable(),
  utmMedium: z.string().max(300).nullable(),
  utmCampaign: z.string().max(300).nullable(),
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
/** Pré-cadastro da emissão de notas (Fase 8): o único formulário com telefone opcional. */
export const NFSE_PRE_REGISTRATION_CONTEXT = "Emissão de notas - pré-cadastro";

export const leadFormSchema = z.object({
  // Limites de tamanho (Fase 10A): bem acima do uso real, abaixo do abuso.
  name: z.string().trim().min(2, "Informe seu nome completo.").max(120, "Nome longo demais."),
  email: z.string().trim().max(254, "E-mail longo demais.").email("Informe um e-mail válido."),
  phone: z.string().trim().max(30, "Telefone longo demais."),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(40).optional().or(z.literal("")),
  businessActivity: z.string().trim().max(160).optional().or(z.literal("")),
  serviceInterest: z.string().trim().min(1, "Selecione um assunto.").max(160),
  // Opcional desde 2026-11-09: no primeiro contato, nome, WhatsApp, e-mail e
  // serviço bastam; exigir texto livre só afastava quem queria ser atendido.
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  consent: z.boolean().refine((value) => value, {
    message: "É necessário concordar com o uso dos dados para enviar.",
  }),
  formContext: z.string().max(80),
  tracking: trackingSchema,
  /** Identificador do envio, gerado no navegador: evita gravar o mesmo lead duas vezes. */
  submissionId: z.string().uuid().optional(),
  /** Campo-armadilha invisível: pessoas não preenchem, robôs costumam preencher. */
  website: z.string().max(200).optional(),
}).superRefine((v, ctx) => {
  // Telefone continua obrigatório em todos os formulários; no pré-cadastro de
  // emissão é opcional, mas se vier precisa ser válido.
  const optional = v.formContext === NFSE_PRE_REGISTRATION_CONTEXT;
  if ((!optional || v.phone !== "") && v.phone.length < 8)
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Informe um WhatsApp válido." });
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const newsletterFormSchema = z.object({
  email: z.string().trim().max(254, "E-mail longo demais.").email("Informe um e-mail válido."),
  tracking: trackingSchema,
});

export type NewsletterFormValues = z.infer<typeof newsletterFormSchema>;

/** Popup "Antes de sair" (2026-10-01): versão curta do lead, sem mensagem livre. */
export const exitIntentLeadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome longo demais."),
  phone: z.string().trim().min(8, "Informe um WhatsApp válido.").max(30),
  email: z.string().trim().max(254).email("Informe um e-mail válido."),
  company: z.string().trim().max(160).optional(),
  serviceInterest: z.string().trim().min(1, "Escolha um assunto.").max(160),
  consent: z.boolean().refine((value) => value, {
    message: "É necessário concordar com o uso dos dados para enviar.",
  }),
});

export type ExitIntentLeadValues = z.infer<typeof exitIntentLeadSchema>;
