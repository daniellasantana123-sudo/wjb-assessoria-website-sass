"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { getTrackingParams } from "@/lib/analytics/tracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { activityOptions, brazilianStates } from "@/config/pricing";
import { serviceCategories } from "@/config/services";
import { type LeadFormValues, leadFormSchema } from "@/lib/validation/lead";

export interface LeadFormProps {
  formContext: string;
  defaultServiceInterest?: string;
  defaultMessage?: string;
  showServiceInterest?: boolean;
  showCompany?: boolean;
  showCity?: boolean;
  showState?: boolean;
  showBusinessActivity?: boolean;
  messageLabel?: string;
  submitLabel?: string;
  onSuccess?: () => void;
}

export function LeadForm({
  formContext,
  defaultServiceInterest,
  defaultMessage = "",
  showServiceInterest = true,
  showCompany = true,
  showCity = false,
  showState = false,
  showBusinessActivity = false,
  messageLabel = "Mensagem",
  submitLabel = "Enviar",
  onSuccess,
}: LeadFormProps) {
  const pathname = usePathname();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
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

  async function onSubmit(values: LeadFormValues) {
    setStatus("idle");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, tracking: getTrackingParams(pathname) }),
      });
      if (!response.ok) throw new Error("request failed");
      setStatus("success");
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
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
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
            <Input id="company" autoComplete="organization" {...register("company")} />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="cnpj">CNPJ (opcional)</Label>
          <Input id="cnpj" autoComplete="off" {...register("cnpj")} />
        </div>

        {showCity ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" autoComplete="address-level2" {...register("city")} />
          </div>
        ) : null}

        {showState ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="state">Estado</Label>
            <Select id="state" autoComplete="address-level1" {...register("state")}>
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
              aria-describedby={errors.serviceInterest ? "serviceInterest-error" : undefined}
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
              <p id="serviceInterest-error" role="alert" className="text-danger text-sm">
                {errors.serviceInterest.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {showBusinessActivity ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="businessActivity">Ramo de atividade</Label>
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
        <Label htmlFor="message">{messageLabel}</Label>
        <Textarea
          id="message"
          rows={5}
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
          <Label htmlFor="consent" className="text-muted-foreground text-sm font-normal">
            Concordo que a WJB Assessoria Contábil utilize os dados informados para
            responder ao meu contato, de acordo com a{" "}
            <Link href="/politica-de-privacidade" className="text-primary underline">
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
          {status === "error" ? (
            <span className="text-danger">
              Não foi possível enviar agora. Tente novamente em instantes.
            </span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
