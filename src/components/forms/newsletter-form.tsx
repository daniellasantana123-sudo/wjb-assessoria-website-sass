"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { getTrackingParams } from "@/lib/analytics/tracking";
import { type NewsletterFormValues, newsletterFormSchema } from "@/lib/validation/lead";

export function NewsletterForm() {
  const pathname = usePathname();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterFormValues>({
    resolver: zodResolver(newsletterFormSchema),
    defaultValues: {
      email: "",
      tracking: {
        sourcePath: pathname,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      },
    },
  });

  async function onSubmit(values: NewsletterFormValues) {
    setStatus("idle");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Newsletter",
          email: values.email,
          message: "Inscrição na newsletter.",
          formContext: "Newsletter",
          tracking: getTrackingParams(pathname),
        }),
      });
      if (!response.ok) throw new Error("request failed");
      setStatus("success");
      reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-2">
      <label htmlFor="newsletter-email" className="text-sm font-medium text-neutral-100">
        Receba nossos conteúdos
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "newsletter-email-error" : undefined}
          className="focus-visible:ring-primary h-10 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:outline-none"
          {...register("email")}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary focus-visible:ring-primary h-10 shrink-0 rounded-md px-4 text-sm font-medium whitespace-nowrap text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
        >
          {isSubmitting ? "..." : "Assinar"}
        </button>
      </div>
      {errors.email ? (
        <p id="newsletter-email-error" role="alert" className="text-sm text-red-400">
          {errors.email.message}
        </p>
      ) : null}
      <p role="status" className="text-sm">
        {status === "success" ? (
          <span className="text-green-400">Inscrição confirmada.</span>
        ) : null}
        {status === "error" ? (
          <span className="text-red-400">Não foi possível assinar agora.</span>
        ) : null}
      </p>
    </form>
  );
}
