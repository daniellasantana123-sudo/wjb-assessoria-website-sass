import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { MessageThread } from "@/components/messages/message-thread";
import { requireSession } from "@/lib/auth/dal";
import { getActiveTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Mensagens",
  robots: { index: false, follow: false },
};

/**
 * Conversa contínua com a WJB, sem assunto/status (diferente de Suporte —
 * ver /portal/suporte) — uma única thread por empresa, mostrada direto
 * (sem lista prévia, o cliente só tem a própria conversa).
 */
export default async function PortalMensagensPage() {
  const session = await requireSession();
  const tenant = await getActiveTenant(session.userId);

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Portal", href: "/portal" }, { label: "Mensagens" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Mensagens</h1>
        {tenant && <p className="text-muted-foreground mt-1 text-sm">{tenant.name}</p>}
      </div>

      {!tenant ? (
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">Nenhuma empresa vinculada ainda</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Assim que a WJB vincular sua conta a uma empresa, você poderá conversar por aqui.
          </p>
        </div>
      ) : (
        <MessageThread tenantId={tenant.id} />
      )}
    </Container>
  );
}
