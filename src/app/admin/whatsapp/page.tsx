import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { getWhatsAppLink } from "@/integrations/whatsapp";
import { requireStaffSession } from "@/lib/auth/dal";
import { isCommercialEnabled } from "@/lib/commercial/config";
import { CLOUD_API_CHECKLIST } from "@/lib/whatsapp/provider";

export const metadata: Metadata = { title: "WhatsApp (canal)", robots: { index: false, follow: false } };

/** Status do canal WhatsApp (Fase 8). Mostra a verdade: não conectado à Cloud API. */
export default async function AdminWhatsAppPage() {
  if (!isCommercialEnabled()) notFound();
  await requireStaffSession();
  const phone = siteConfig.contact.phones[0];
  const mock = process.env["WJB_WHATSAPP_MOCK_ENABLED"] === "true";
  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "WhatsApp" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-foreground text-2xl font-semibold">Canal WhatsApp</h1>
        <Badge tone="danger">Não conectado à Cloud API</Badge>
      </div>
      <dl className="border-border grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border p-5 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Número público</dt><dd>{phone ? `${phone.display} (+${phone.e164})` : "não configurado"}</dd></div>
        <div><dt className="text-muted-foreground">Uso atual no site</dt><dd>Link click-to-chat (wa.me), sem API</dd></div>
        <div><dt className="text-muted-foreground">Envio automático</dt><dd>Desligado (nenhuma mensagem é enviada pela plataforma)</dd></div>
        <div><dt className="text-muted-foreground">Webhook de teste</dt><dd>{mock ? "Simulado ligado nesta instância (sem tráfego real)" : "Desligado"}</dd></div>
      </dl>
      {getWhatsAppLink() ? (
        <p className="text-sm">
          Link público:{" "}
          <a href={getWhatsAppLink() ?? "#"} target="_blank" rel="noopener noreferrer" className="text-primary break-all underline">
            {`https://wa.me/${phone?.e164}`}
          </a>
        </p>
      ) : null}
      <section aria-labelledby="pendencias" className="border-border rounded-md border p-5">
        <h2 id="pendencias" className="text-foreground mb-2 font-semibold">Para ligar a Cloud API (todas pendentes)</h2>
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
          {CLOUD_API_CHECKLIST.map((c) => <li key={c}>{c}</li>)}
        </ol>
        <p className="text-muted-foreground mt-3 text-xs">
          O número já usado no app WhatsApp Business não está, por isso, registrado na Cloud API. Registrar ou migrar o número exige
          autorização específica e verificação de compatibilidade. Tokens, PINs e códigos nunca são pedidos por chat.
        </p>
      </section>
    </Container>
  );
}
