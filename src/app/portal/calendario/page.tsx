import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { ObligationsCalendar } from "@/components/obligations/obligations-calendar";
import { requireSession } from "@/lib/auth/dal";
import { getMyPrimaryTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Calendário",
  robots: { index: false, follow: false },
};

function parseIntParam(value: string | string[] | undefined, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function PortalCalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[]; month?: string | string[] }>;
}) {
  const session = await requireSession();
  const tenant = await getMyPrimaryTenant(session.userId);
  const params = await searchParams;

  const now = new Date();
  const year = parseIntParam(params.year, now.getFullYear());
  const month = parseIntParam(params.month, now.getMonth() + 1);

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb items={[{ label: "Portal", href: "/portal" }, { label: "Calendário" }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Calendário</h1>
          {tenant && <p className="text-muted-foreground mt-1 text-sm">{tenant.name}</p>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <Badge tone="neutral">Pendente</Badge>
          </span>
          <span className="flex items-center gap-1.5">
            <Badge tone="danger">Atrasada</Badge>
          </span>
          <span className="flex items-center gap-1.5">
            <Badge tone="success">Concluída</Badge>
          </span>
        </div>
      </div>

      {!tenant ? (
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">Nenhuma empresa vinculada ainda</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Assim que a WJB vincular sua conta a uma empresa, o calendário de obrigações aparece
            aqui.
          </p>
        </div>
      ) : (
        <ObligationsCalendar tenantId={tenant.id} year={year} month={month} />
      )}
    </Container>
  );
}
