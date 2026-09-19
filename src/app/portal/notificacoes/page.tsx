import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { requireSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Notificações",
  robots: { index: false, follow: false },
};

export default async function PortalNotificacoesPage() {
  await requireSession();

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Portal", href: "/portal" }, { label: "Notificações" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Notificações</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Avisos de tickets e mensagens da sua empresa.
        </p>
      </div>

      <NotificationsList />
    </Container>
  );
}
