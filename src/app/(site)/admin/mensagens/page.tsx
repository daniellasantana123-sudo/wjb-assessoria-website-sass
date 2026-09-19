import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { ConversationsList } from "@/components/messages/conversations-list";
import { requireStaffSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Mensagens",
  robots: { index: false, follow: false },
};

export default async function AdminMensagensPage() {
  await requireStaffSession();

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "Mensagens" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Mensagens</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Conversa contínua com cada empresa cliente - uma por linha abaixo.
        </p>
      </div>

      <ConversationsList />
    </Container>
  );
}
