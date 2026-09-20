import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { MfaSettings } from "@/components/security/mfa-settings";
import { listTotpFactors } from "@/actions/mfa";
import { requireStaffSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Segurança",
  robots: { index: false, follow: false },
};

export default async function AdminSecurityPage() {
  await requireStaffSession();
  const factors = await listTotpFactors();

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <div>
        <h1 className="text-foreground text-2xl font-semibold">Segurança</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Gerencie a proteção da sua conta.
        </p>
      </div>

      <MfaSettings factors={factors} />
    </Container>
  );
}
