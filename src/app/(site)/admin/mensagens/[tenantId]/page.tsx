import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { MessageThread } from "@/components/messages/message-thread";
import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Mensagens",
  robots: { index: false, follow: false },
};

export default async function AdminMensagensTenantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requireStaffSession();
  const { tenantId } = await params;

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) notFound();

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Admin WJB", href: "/admin" },
          { label: "Mensagens", href: "/admin/mensagens" },
          { label: tenant.name },
        ]}
      />

      <h1 className="text-foreground text-2xl font-semibold">{tenant.name}</h1>

      <MessageThread tenantId={tenant.id} />
    </Container>
  );
}
