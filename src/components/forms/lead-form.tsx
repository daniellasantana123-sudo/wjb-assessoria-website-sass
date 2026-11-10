"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";

import { pushEvent } from "@/lib/analytics/datalayer";
import {
  getAttributionParams,
  getTrackingParams,
} from "@/lib/analytics/tracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { activityOptions, brazilianStates } from "@/config/pricing";
import { serviceCategories } from "@/config/services";
import { siteConfig } from "@/config/site";
import { getWhatsAppLink } from "@/integrations/whatsapp";
import type { LeadFormValues } from "@/lib/validation/lead";
import { lazyResolver } from "@/lib/validation/lazy-resolver";

export interface LeadFormProps {
  formContext: string;
  defaultServiceInterest?: string;
  defaultMessage?: string;
  showServiceInterest?: boolean;
  showCompany?: boolean;
  /**
   * CNPJ é opcional; escondido onde a pessoa ainda não tem empresa (Abrir
   * Empresa) ou o espaço é pequeno (assistente virtual). 2026-11-10.
   */
  showCnpj?: boolean;
  showCity?: boolean;
  showState?: boolean;
  showBusinessActivity?: boolean;
  messageLabel?: string;
  submitLabel?: string;
  onSuccess?: () => void;
  /**
   * Chamado quando o envio falhou (2026-09-23). Existe pra quem tem um
   * canal alternativo próprio - o Assistente Virtual abre o WhatsApp com os
   * dados já preenchidos em vez de deixar a pessoa num beco sem saída.
   * Quando não é passado, o formulário mostra sozinho o aviso com WhatsApp/
   * e-mail abaixo.
   */
  onError?: () => void;
}

// zod só é baixado na primeira validação (ver lazy-resolver.ts).
const leadFormSchemaResolver = lazyResolver(() =>
  Promise.all([
    import("@hookform/resolvers/zod"),
    import("@/lib/validation/lead"),
  ]).then(([{ zodResolver }, mod]) => zodResolver(mod.leadFormSchema)),
);

export function LeadForm({
  formContext,
  defaultServiceInterest,
  defaultMessage = "",
  showServiceInterest = true,
  showCompany = true,
  showCnpj = true,
  showCity = false,
  showState = false,
  showBusinessActivity = false,
  messageLabel = "Mensagem",
  submitLabel = "Enviar",
  onSuccess,
  onError,
}: LeadFormProps) {
  const pathname = usePathname();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  // Um identificador por envio: se a pessoa clicar duas vezes ou tentar de
  // novo após erro de rede, o servidor reconhece e não grava o lead em dobro.
  // Renovado depois de cada envio bem-sucedido.
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const whatsAppFallbackLink = getWhatsAppLink(
    `Olá! Tentei enviar uma mensagem pelo site (${formContext}) e não consegui. Pode me ajudar por aqui?`,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: leadFormSchemaResolver,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      cnpj: "",
      city: "",
      state: "",
      businessActivity: "",
      serviceInterest: defaultServiceInterest ?? "",
      message: defaultMessage,
      consent: false,
      formContext,
      tracking: {
        sourcePath: pathname,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      },
    },
  });

  // `form_start`: uma vez por formulário montado, no primeiro foco real.
  const formStarted = useRef(false);
  function handleFormStart() {
    if (formStarted.current) return;
    formStarted.current = true;
    pushEvent("form_start", { form_id: formContext });
  }

  async function onSubmit(values: LeadFormValues) {
    setStatus("idle");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          submissionId,
          tracking: getTrackingParams(pathname),
        }),
      });
      if (!response.ok) throw new Error("request failed");
      const result = (await response.json().catch(() => null)) as {
        persisted?: boolean;
        leadId?: string | null;
      } | null;
      // Conversão só quando o servidor confirma que o lead foi gravado
      // (plano CRO): um 200 sem gravação não conta. `leadId` é um UUID
      // gerado no servidor, sem dado pessoal, e serve de `event_id` para
      // a deduplicação no GA4/Google Ads.
      if (result?.persisted && result.leadId) {
        pushEvent("generate_lead", {
          event_id: result.leadId,
          form_id: formContext,
          service_name: values.serviceInterest,
          ...getAttributionParams(),
        });
      }
      setStatus("success");
      setSubmissionId(crypto.randomUUID());
      reset({
        name: "",
        email: "",
        phone: "",
        company: "",
        cnpj: "",
        city: "",
        state: "",
        businessActivity: "",
        serviceInterest: defaultServiceInterest ?? "",
        message: defaultMessage,
        consent: false,
        formContext,
        tracking: {
          sourcePath: pathname,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
        },
      });
      onSuccess?.();
    } catch {
      setStatus("error");
      onError?.();
    }
  }

  return (
    <form
      onFocusCapture={handleFormStart}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name"
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
          {errors.name ? (
            <p id="name-error" role="alert" className="text-danger text-sm">
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="email-error" role="alert" className="text-danger text-sm">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">WhatsApp</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
            {...register("phone")}
          />
          {errors.phone ? (
            <p id="phone-error" role="alert" className="text-danger text-sm">
              {errors.phone.message}
            </p>
          ) : null}
        </div>

        {showCompany ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="company">Empresa (opcional)</Label>
            <Input
              id="company"
              autoComplete="organization"
              {...register("company")}
            />
          </div>
        ) : null}

        {showCnpj ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="cnpj">CNPJ (opcional)</Label>
            <Input id="cnpj" autoComplete="off" {...register("cnpj")} />
          </div>
        ) : null}

        {showCity ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="city">Cidade (opcional)</Label>
            <Input
              id="city"
              autoComplete="address-level2"
              {...register("city")}
            />
          </div>
        ) : null}

        {showState ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="state">Estado (opcional)</Label>
            <Select
              id="state"
              autoComplete="address-level1"
              {...register("state")}
            >
              <option value="">Selecione o estado</option>
              {brazilianStates.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        {showServiceInterest ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="serviceInterest">Assunto</Label>
            <Select
              id="serviceInterest"
              aria-invalid={!!errors.serviceInterest}
              aria-describedby={
                errors.serviceInterest ? "serviceInterest-error" : undefined
              }
              {...register("serviceInterest")}
            >
              <option value="">Selecione um assunto</option>
              {serviceCategories.map((service) => (
                <option key={service.href} value={service.title}>
                  {service.title}
                </option>
              ))}
            </Select>
            {errors.serviceInterest ? (
              <p
                id="serviceInterest-error"
                role="alert"
                className="text-danger text-sm"
              >
                {errors.serviceInterest.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {showBusinessActivity ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="businessActivity">
              Ramo de atividade (opcional)
            </Label>
            <Select id="businessActivity" {...register("businessActivity")}>
              <option value="">Selecione o ramo de atividade</option>
              {activityOptions.map((activity) => (
                <option key={activity.value} value={activity.label}>
                  {activity.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">
          {messageLabel}{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Textarea
          id="message"
          rows={4}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          {...register("message")}
        />
        {errors.message ? (
          <p id="message-error" role="alert" className="text-danger text-sm">
            {errors.message.message}
          </p>
        ) : null}
      </div>

      <input type="hidden" {...register("formContext")} />
      {/*
       * Campo-armadilha contra robôs (2026-11-09): fora da tela, sem foco
       * pelo teclado e escondido de leitores de tela. Quem preencher é
       * tratado como robô pelo servidor.
       */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor="website">Não preencha este campo</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <input
            id="consent"
            type="checkbox"
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? "consent-error" : undefined}
            className="border-border text-primary focus-visible:ring-primary mt-0.5 h-4 w-4 shrink-0 rounded focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            {...register("consent")}
          />
          <Label
            htmlFor="consent"
            className="text-muted-foreground text-sm font-normal"
          >
            Concordo que a WJB Assessoria Contábil utilize os dados informados
            para responder ao meu contato, de acordo com a{" "}
            <Link
              href="/politica-de-privacidade"
              className="text-primary underline"
            >
              Política de Privacidade
            </Link>
            .
          </Label>
        </div>
        {errors.consent ? (
          <p id="consent-error" role="alert" className="text-danger text-sm">
            {errors.consent.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" variant="cta" disabled={isSubmitting}>
          {isSubmitting ? "Enviando..." : submitLabel}
        </Button>
        <p role="status" className="text-sm">
          {status === "success" ? (
            <span className="text-success">
              Mensagem enviada! Em breve alguém da WJB entra em contato.
            </span>
          ) : null}
          {/*
           * Fallback real em vez de "tente novamente em instantes"
           * (2026-09-23): quando o envio falha por indisponibilidade do
           * nosso lado (`/api/leads` responde 503), repetir não resolve -
           * o que resolve é oferecer os canais que continuam funcionando.
           */}
          {status === "error" ? (
            <span className="text-danger">
              Não foi possível enviar agora. Fale com a gente pelo{" "}
              <a
                href={whatsAppFallbackLink ?? siteConfig.contact.phones[0].href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                WhatsApp
              </a>{" "}
              ou por{" "}
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="underline underline-offset-2"
              >
                e-mail
              </a>
              .
            </span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
