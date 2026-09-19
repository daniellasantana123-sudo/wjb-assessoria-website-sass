import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { requireStaffSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Notificações",
  robots: { index: false, follow: false },
};

export default async function AdminNotificacoesPage() {
  await requireStaffSession();

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "Notificações" }]} />

      <div>
        <h1 className="text-foreground text-2xl font-semibold">Notificações</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Avisos de tickets e mensagens de todas as empresas clientes.
        </p>
      </div>

      <NotificationsList />
    </Container>
  );
}
