import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { CreateTenantForm } from "@/components/admin/create-tenant-form";
import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession } from "@/lib/auth/dal";
import { clientMatches } from "@/lib/integrations/client-search";
import { hasPermission } from "@/lib/permissions/permissions";

export const metadata: Metadata = {
  title: "Empresas",
  robots: { index: false, follow: false },
};

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireStaffSession();
  const { q } = await searchParams;
  const canImport =
    hasPermission(session, "organizations.manage") && hasPermission(session, "integrations.manage");

  const supabase = await createClient();
  const { data: allTenants } = await supabase
    .from("tenants")
    .select("id, name, cnpj, status, created_at")
    .order("created_at", { ascending: false });

  /*
   * Filtro feito aqui, não no banco (2026-10-01): o `ilike` do banco
   * diferenciava acento e não achava um CNPJ digitado sem pontuação quando
   * ele estava gravado com pontuação. A lista de empresas é pequena o
   * bastante para filtrar em memória com a mesma regra da busca do G-Click.
   */
  const term = q?.trim() ?? "";
  const tenants = term
    ? (allTenants ?? []).filter((tenant) => clientMatches({ name: tenant.name, document: tenant.cnpj }, term))
    : (allTenants ?? []);

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Empresas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Empresas clientes cadastradas na plataforma.
          </p>
        </div>
        {canImport && (
          <Link href="/admin/empresas/importar" className={buttonVariants({ variant: "primary" })}>
            Importar do G-Click
          </Link>
        )}
      </div>

      <div className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">Nova empresa</h2>
        <CreateTenantForm />
      </div>

      <form method="get" className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="q">Buscar empresas da plataforma por nome ou CNPJ</Label>
          <Input id="q" name="q" type="search" defaultValue={q ?? ""} />
        </div>
        <button type="submit" className={buttonVariants({ variant: "outline", size: "md" })}>
          Buscar
        </button>
      </form>

      <div className="border-border divide-border divide-y rounded-md border">
        {tenants.length === 0 ? (
          <div className="flex flex-col gap-2 p-6">
            <p className="text-muted-foreground text-sm">
              {term ? "Nenhuma empresa da plataforma encontrada para essa busca." : "Nenhuma empresa cadastrada ainda."}
            </p>
            {canImport && (
              <Link
                href={`/admin/empresas/importar${term ? `?q=${encodeURIComponent(term)}` : ""}`}
                className="text-primary self-start text-sm font-medium underline underline-offset-4"
              >
                {term ? `Procurar "${term}" no G-Click e importar →` : "Importar clientes do G-Click →"}
              </Link>
            )}
          </div>
        ) : (
          tenants.map((tenant) => (
            <Link
              key={tenant.id}
              href={`/admin/empresas/${tenant.id}`}
              className="hover:bg-muted/30 focus-visible:ring-primary flex items-center justify-between gap-3 p-4 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0">
                  <p className="text-foreground font-medium break-words">{tenant.name}</p>
                  {tenant.cnpj && (
                    <p className="text-muted-foreground text-sm">{tenant.cnpj}</p>
                  )}
                </div>
                {tenant.status === "suspended" && <Badge tone="danger">Suspensa</Badge>}
              </div>
              <span className="text-muted-foreground shrink-0 text-sm">Ver empresa →</span>
            </Link>
          ))
        )}
      </div>
    </Container>
  );
}
