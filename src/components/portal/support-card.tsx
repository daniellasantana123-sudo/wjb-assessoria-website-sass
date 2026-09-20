import Link from "next/link";
import { LifeBuoy, Mail, MessageCircle } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { getWhatsAppLink } from "@/integrations/whatsapp";

/**
 * "Precisa de ajuda?" no Dashboard do Portal (Fase 6 do wjb-saas-mvp) -
 * WhatsApp oficial + e-mail (seção "Suporte" do prompt) + ticket (a
 * infraestrutura de Tickets já existe desde a SAAS FASE 3/4 - o prompt só
 * pede ticket "se infraestrutura já existir", que é o caso aqui).
 */
export function SupportCard() {
  const whatsappLink = getWhatsAppLink();

  return (
    <div className="border-border bg-background rounded-md border p-6">
      <h2 className="text-foreground text-sm font-semibold">Precisa de ajuda?</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Fale com a WJB pelo canal que preferir.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            WhatsApp
          </a>
        )}
        <a
          href={`mailto:${siteConfig.contact.email}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Mail className="size-4" aria-hidden="true" />
          E-mail
        </a>
        <Link href="/portal/suporte" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <LifeBuoy className="size-4" aria-hidden="true" />
          Abrir chamado
        </Link>
      </div>
    </div>
  );
}
