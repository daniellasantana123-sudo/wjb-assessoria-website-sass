import { NextResponse } from "next/server";

import { isRateLimited } from "@/lib/security/rate-limit";
import { leadFormSchema, newsletterFormSchema } from "@/lib/validation/lead";
import { createClient } from "@/lib/db/supabase/server";
import { getEmailAdapter } from "@/integrations/email";
import { renderNotificationEmail } from "@/integrations/email/templates";
import { getWhatsAppBusinessAdapter } from "@/integrations/whatsapp-business";
import { siteConfig } from "@/config/site";
import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * SAAS FASE 4 — persiste em `public.leads` (RLS: insert público, leitura
 * só staff — ver `0010_leads_table.sql`). Provider de e-mail escolhido em
 * 2026-09-17 (Resend, seção 36) — notifica o time WJB por e-mail além de
 * gravar no banco (só pra lead de verdade, não newsletter — ver abaixo).
 * WhatsApp (Meta WhatsApp Business Platform, escolhido em 2026-09-18) avisa
 * o mesmo time por template aprovado, ver abaixo. CRM foi cancelado pelo
 * usuário em 2026-09-18 — fora do escopo da FASE 5 (`docs/api/integrations.md`).
 *
 * `formContext === "Newsletter"` valida contra um schema menor
 * (`newsletterFormSchema`) — bug real corrigido em 2026-09-16: o endpoint
 * validava TODO envio contra `leadFormSchema` (exige telefone, assunto e
 * consentimento), então toda inscrição de newsletter falhava
 * silenciosamente, mesmo enviando o payload que `NewsletterForm` já
 * mandava.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um momento e tente novamente." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const isNewsletter =
    typeof body === "object" &&
    body !== null &&
    "formContext" in body &&
    (body as { formContext?: unknown }).formContext === "Newsletter";

  const supabase = await createClient();

  if (isNewsletter) {
    const result = newsletterFormSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", issues: result.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("leads").insert({
      name: "Newsletter",
      email: result.data.email,
      message: "Inscrição na newsletter.",
      form_context: "Newsletter",
      source_path: result.data.tracking.sourcePath,
      utm_source: result.data.tracking.utmSource,
      utm_medium: result.data.tracking.utmMedium,
      utm_campaign: result.data.tracking.utmCampaign,
    });

    if (error) {
      console.error("[leads] falha ao salvar inscrição de newsletter:", error);
      return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const result = leadFormSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("leads").insert({
    name: result.data.name,
    email: result.data.email,
    phone: result.data.phone,
    company: result.data.company || null,
    cnpj: result.data.cnpj || null,
    city: result.data.city || null,
    state: result.data.state || null,
    business_activity: result.data.businessActivity || null,
    service_interest: result.data.serviceInterest,
    message: result.data.message,
    form_context: result.data.formContext,
    source_path: result.data.tracking.sourcePath,
    utm_source: result.data.tracking.utmSource,
    utm_medium: result.data.tracking.utmMedium,
    utm_campaign: result.data.tracking.utmCampaign,
  });

  if (error) {
    console.error("[leads] falha ao salvar lead:", error);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }

  /**
   * Best-effort — nunca derruba a resposta ao visitante. Sem
   * `RESEND_API_KEY`/`EMAIL_FROM`, `getEmailAdapter()` devolve o adapter
   * no-op (só loga), então isto é seguro antes do domínio estar verificado.
   */
  const emailAdapter = getEmailAdapter();
  const adminLeadsUrl = new URL("/admin/leads", getSiteUrl()).toString();
  try {
    await emailAdapter.send({
      to: siteConfig.contact.email,
      subject: `Novo lead do site — ${result.data.name}`,
      html: renderNotificationEmail({
        title: "Novo lead recebido",
        body: `${result.data.name} (${result.data.email}, ${result.data.phone}) preencheu "${result.data.formContext}" — assunto: ${result.data.serviceInterest}.`,
        ctaLabel: "Ver no Admin",
        ctaUrl: adminLeadsUrl,
      }),
      text: `${result.data.name} (${result.data.email}, ${result.data.phone}) preencheu "${result.data.formContext}". Ver em ${adminLeadsUrl}`,
    });
  } catch (sendError) {
    console.error("[leads] falha ao enviar e-mail de novo lead:", sendError);
  }

  /**
   * Best-effort, mesmo racional do e-mail acima. Sem
   * `WHATSAPP_LEAD_TEMPLATE_NAME` configurada (template ainda não criado/
   * aprovado no Meta Business Manager), não tenta enviar — a Cloud API
   * exige um template pré-aprovado pra mensagem business-initiated (fora da
   * janela de 24h), então não há um nome de template genérico pra chutar
   * aqui. Ver `docs/api/integrations.md`.
   */
  const whatsappTemplateName = process.env.WHATSAPP_LEAD_TEMPLATE_NAME;
  const notifyPhone = siteConfig.contact.phones[0];
  if (whatsappTemplateName && notifyPhone) {
    try {
      await getWhatsAppBusinessAdapter().sendTemplate({
        to: notifyPhone.e164,
        templateName: whatsappTemplateName,
        bodyParams: [result.data.name, result.data.serviceInterest],
      });
    } catch (sendError) {
      console.error("[leads] falha ao enviar WhatsApp de novo lead:", sendError);
    }
  }

  return NextResponse.json({ ok: true });
}
