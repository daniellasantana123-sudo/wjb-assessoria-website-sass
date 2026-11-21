import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import {
  commercialWhatsAppMessages,
  getCommercialWhatsAppLink,
  type CommercialWhatsAppIntent,
} from "@/integrations/whatsapp";
import { requireStaffSession } from "@/lib/auth/dal";
import { isCommercialEnabled } from "@/lib/commercial/config";

export const metadata: Metadata = { title: "WhatsApp (Click-to-Chat)", robots: { index: false, follow: false } };

const INTENT_LABEL: Record<CommercialWhatsAppIntent, string> = {
  mei: "Plano MEI Digital",
  somenteEmissao: "Só emissão de NFS-e",
  combo: "Contabilidade + emissão",
  altoVolume: "Alto volume",
  contabilidade: "Contabilidade (padrão do site)",
  duvidaEmissao: "Dúvida sobre emissão",
};

/**
 * Canal WhatsApp da WJB (Fase 9): Click-to-Chat. Decisão da WJB em
 * 21/11/2026: não usar a WhatsApp Cloud API. Os links só abrem a conversa com
 * mensagem pronta; a plataforma não envia, não recebe e não lê mensagens.
 */
export default async function AdminWhatsAppPage() {
  if (!isCommercialEnabled()) notFound();
  await requireStaffSession();
  const phone = siteConfig.contact.phones[0];
  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "WhatsApp" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-foreground text-2xl font-semibold">WhatsApp comercial</h1>
        <Badge tone="info">Click-to-Chat (sem API de mensagens)</Badge>
      </div>
      <dl className="border-border grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border p-5 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Número oficial</dt><dd>{phone ? `${phone.display} (+${phone.e164})` : "não configurado"}</dd></div>
        <div><dt className="text-muted-foreground">Como funciona</dt><dd>O botão abre o WhatsApp com uma mensagem pronta; o cliente confirma o envio</dd></div>
        <div><dt className="text-muted-foreground">Envio, leitura e webhooks</dt><dd>Não existem: a plataforma não envia nem recebe mensagens</dd></div>
        <div><dt className="text-muted-foreground">Medição</dt><dd>Só o clique no botão, com consentimento de cookies. Não sabemos se a conversa foi enviada ou respondida</dd></div>
      </dl>

      <section aria-labelledby="mensagens" className="flex flex-col gap-3">
        <h2 id="mensagens" className="text-foreground text-lg font-semibold">Mensagens prontas por intenção</h2>
        <p className="text-muted-foreground text-sm">
          Definidas em <code>src/integrations/whatsapp</code>. Nenhuma inclui dado do cliente (nome, CPF/CNPJ, valores ou notas).
        </p>
        <ul className="border-border divide-border divide-y rounded-md border">
          {(Object.keys(commercialWhatsAppMessages) as CommercialWhatsAppIntent[]).map((intent) => (
            <li key={intent} className="flex flex-col gap-1 px-4 py-3 text-sm">
              <strong>{INTENT_LABEL[intent]}</strong>
              <span className="text-muted-foreground">{commercialWhatsAppMessages[intent]}</span>
              <a
                href={getCommercialWhatsAppLink(intent) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary self-start text-xs underline"
              >
                Testar o link<span className="sr-only"> {INTENT_LABEL[intent]} (abre o WhatsApp em nova aba)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-muted-foreground text-xs">
        Atendimento automatizado de ponta a ponta acontece no chat do site (assistente Dani). Automação dentro do próprio WhatsApp
        exigiria um canal oficial compatível, uma decisão futura da WJB. Nunca use automação por QR Code, sessão não oficial do
        WhatsApp Web ou bibliotecas não autorizadas.
      </p>
    </Container>
  );
}
