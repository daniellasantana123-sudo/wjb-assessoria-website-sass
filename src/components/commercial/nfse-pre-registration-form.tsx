"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { pushEvent } from "@/lib/analytics/datalayer";
import { getAttributionParams, getTrackingParams } from "@/lib/analytics/tracking";
import { NFSE_PRE_REGISTRATION_CONTEXT } from "@/lib/validation/lead";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Pré-cadastro / lista de interesse da emissão de notas (Fase 8). Dados
 * mínimos; nunca pede CPF, certificado, senha do gov.br ou XML. Envia pela
 * mesma API de leads (validação no servidor, anti-spam, deduplicação).
 * Não cria conta nem assinatura.
 */
const PERFIS = ["MEI", "ME/EPP", "Profissional autônomo (CPF)", "Ainda não tenho empresa"];
const VOLUME = ["Até 10 notas por mês", "11 a 50", "51 a 150", "Mais de 150"];
export const PRE_REGISTRATION_OBJECTIVES = ["Só emissão de NFS-e", "MEI Digital", "Contabilidade completa", "Contabilidade + emissão (combo)", "Alto volume"] as const;
const OBJETIVOS = PRE_REGISTRATION_OBJECTIVES;

export function NfsePreRegistrationForm({ defaultObjective }: { defaultObjective?: (typeof PRE_REGISTRATION_OBJECTIVES)[number] } = {}) {
  const pathname = usePathname();
  const submissionId = useRef(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("consent") !== "on") {
      setError("É necessário concordar com o uso dos dados para enviar.");
      return;
    }
    setStatus("sending");
    setError(null);
    const objetivo = String(fd.get("objetivo") ?? "");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(fd.get("name") ?? ""),
          email: String(fd.get("email") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          city: String(fd.get("city") ?? ""),
          businessActivity: String(fd.get("perfil") ?? ""),
          serviceInterest: `Emissão de notas: ${objetivo}`,
          message: `Notas por mês: ${String(fd.get("volume") ?? "não informado")}. Aceita comunicações de marketing: ${fd.get("marketing") === "on" ? "sim" : "não"}.`,
          consent: true,
          formContext: NFSE_PRE_REGISTRATION_CONTEXT,
          tracking: getTrackingParams(pathname),
          submissionId: submissionId.current,
          website: String(fd.get("website") ?? ""),
        }),
      });
      if (res.status === 400) {
        setStatus("idle");
        setError("Confira nome, e-mail e, se informar, o WhatsApp.");
        return;
      }
      if (!res.ok) throw new Error("falha");
      const result = (await res.json().catch(() => null)) as { persisted?: boolean; leadId?: string | null } | null;
      if (result?.persisted && result.leadId)
        pushEvent("generate_lead", { event_id: result.leadId, form_id: NFSE_PRE_REGISTRATION_CONTEXT, service_name: objetivo, ...getAttributionParams() });
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok")
    return (
      <p role="status" className="border-success/40 bg-success/10 rounded-md border p-4 text-sm">
        Pronto! Você está na lista de interesse. A equipe da WJB entra em contato quando o serviço estiver liberado para o seu perfil.
      </p>
    );

  return (
    <form onSubmit={onSubmit} method="post" className="flex flex-col gap-4" noValidate>
      {/* Fase 10E: até a hidratação os campos ficam desativados. Antes disso o
          react-hook-form, ao registrar os campos, apagava o que já tinha sido
          digitado (visto no WebKit e em celular lento). */}
      <fieldset disabled={!hydrated} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5"><Label htmlFor="pc-name">Nome</Label><Input id="pc-name" name="name" autoComplete="name" required minLength={2} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="pc-email">E-mail</Label><Input id="pc-email" name="email" type="email" autoComplete="email" required /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="pc-phone">WhatsApp (opcional)</Label><Input id="pc-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="pc-city">Município</Label><Input id="pc-city" name="city" autoComplete="address-level2" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="pc-perfil">Perfil</Label>
          <Select id="pc-perfil" name="perfil" defaultValue="MEI">{PERFIS.map((p) => <option key={p}>{p}</option>)}</Select></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="pc-volume">Quantas notas por mês, mais ou menos?</Label>
          <Select id="pc-volume" name="volume" defaultValue={VOLUME[0]}>{VOLUME.map((v) => <option key={v}>{v}</option>)}</Select></div>
        <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="pc-obj">O que você procura?</Label>
          <Select id="pc-obj" name="objetivo" defaultValue={defaultObjective ?? OBJETIVOS[0]}>{OBJETIVOS.map((o) => <option key={o}>{o}</option>)}</Select></div>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" className="mt-1 size-4" required />
        <span>Concordo com o uso destes dados para a WJB entrar em contato sobre o serviço, conforme a <Link href="/politica-de-privacidade" className="text-primary underline">Política de Privacidade</Link>.</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="marketing" className="mt-1 size-4" />
        <span>Quero receber novidades da WJB (opcional, separado do contato acima).</span>
      </label>
      <p className="text-muted-foreground text-xs">Não pedimos CPF, certificado digital nem senha do gov.br neste cadastro.</p>
      {error ? <p role="alert" className="text-danger text-sm">{error}</p> : null}
      {status === "error" ? <p role="alert" className="text-danger text-sm">Não foi possível enviar agora. Tente de novo em instantes ou fale pelo WhatsApp.</p> : null}
      <Button type="submit" variant="cta" disabled={!hydrated || status === "sending"} className="self-start">
        {status === "sending" ? "Enviando..." : "Entrar na lista de interesse"}
      </Button>
      </fieldset>
    </form>
  );
}
