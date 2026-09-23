import { NextResponse } from "next/server";

import { isRateLimited } from "@/lib/security/rate-limit";
import { leadFormSchema, newsletterFormSchema } from "@/lib/validation/lead";
import { createClient, isSupabaseConfigured } from "@/lib/db/supabase/server";
import { getEmailAdapter } from "@/integrations/email";
import { renderNotificationEmail } from "@/integrations/email/templates";
import { getWhatsAppBusinessAdapter } from "@/integrations/whatsapp-business";
import { siteConfig } from "@/config/site";
import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * 503 + `code` legível por máquina (2026-09-23) - o cliente precisa
 * distinguir "seus dados estão inválidos" (400, o visitante corrige) de
 * "nosso armazenamento está indisponível" (aqui, não é culpa dele e
 * repetir o envio não resolve), pra oferecer o canal alternativo certo em
 * vez do antigo "tente novamente em instantes", que era falso nesse caso.
 */
function storageUnavailable() {
  return NextResponse.json(
    {
      ok: false,
      code: "storage_unavailable",
      error: "Não foi possível registrar seu contato agora.",
    },
    { status: 503 },
  );
}

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
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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

  /**
   * `null` quando não há credenciais de Supabase no ambiente (2026-09-23) -
   * antes isto era `await createClient()` direto, que lança nesse caso e
   * derrubava a rota com 500 antes mesmo de validar o payload. Em produção
   * (Hostinger, sem as env vars do SaaS) isso quebrava TODOS os formulários
   * da V1 de uma vez: Assistente Virtual, /contato, /solicitar-proposta,
   * páginas de serviço e newsletter. Agora a falta de banco degrada pra um
   * caminho controlado (`storageUnavailable()` acima) em vez de derrubar a
   * captação inteira.
   */
  const supabase = isSupabaseConfigured() ? await createClient() : null;

  if (isNewsletter) {
    const result = newsletterFormSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos.",
          issues: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    if (!supabase) {
      console.error(
        "[leads] Supabase não configurado — inscrição de newsletter não foi salva.",
      );
      return storageUnavailable();
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
      return storageUnavailable();
    }

    return NextResponse.json({ ok: true, persisted: true });
  }

  const result = leadFormSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  let persisted = false;
  if (supabase) {
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

    if (error) console.error("[leads] falha ao salvar lead:", error);
    else persisted = true;
  } else {
    console.error(
      "[leads] Supabase não configurado — lead não foi salvo no banco.",
    );
  }

  /**
   * Best-effort — nunca derruba a resposta ao visitante. Sem
   * `RESEND_API_KEY`/`EMAIL_FROM`, `getEmailAdapter()` devolve o adapter
   * no-op (só loga), então isto é seguro antes do domínio estar verificado.
   *
   * Roda mesmo quando a gravação falhou (2026-09-23): se o e-mail sair de
   * verdade, o lead chegou ao time da WJB e o visitante não precisa ver
   * erro nenhum - é o banco que está indisponível, não o contato dele.
   */
  let notified = false;
  const emailAdapter = getEmailAdapter();
  const adminLeadsUrl = new URL("/admin/leads", getSiteUrl()).toString();
  try {
    const sendResult = await emailAdapter.send({
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
    notified = sendResult.ok;
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
      console.error(
        "[leads] falha ao enviar WhatsApp de novo lead:",
        sendError,
      );
    }
  }

  /**
   * Nem banco nem e-mail: o lead não chegou a lugar nenhum, então não dá
   * pra responder "ok" (seria mentir pro visitante e perder o contato em
   * silêncio). O cliente usa esse `code` pra oferecer o caminho que ainda
   * funciona - no Assistente Virtual, abrir o WhatsApp com os dados já
   * preenchidos; nos demais formulários, mostrar WhatsApp/e-mail direto.
   */
  if (!persisted && !notified) return storageUnavailable();

  return NextResponse.json({ ok: true, persisted });
}
