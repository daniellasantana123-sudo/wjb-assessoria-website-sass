import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { CreateTenantForm } from "@/components/admin/create-tenant-form";
import { createClient } from "@/lib/db/supabase/server";
import { requireStaffSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Empresas",
  robots: { index: false, follow: false },
};

export default async function EmpresasPage() {
  await requireStaffSession();

  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, cnpj, created_at")
    .order("created_at", { ascending: false });

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <div>
        <h1 className="text-foreground text-2xl font-semibold">Empresas</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Empresas clientes cadastradas na plataforma.
        </p>
      </div>

      <div className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">Nova empresa</h2>
        <CreateTenantForm />
      </div>

      <div className="border-border divide-border divide-y rounded-md border">
        {!tenants || tenants.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">
            Nenhuma empresa cadastrada ainda.
          </p>
        ) : (
          tenants.map((tenant) => (
            <Link
              key={tenant.id}
              href={`/admin/empresas/${tenant.id}`}
              className="hover:bg-muted/30 focus-visible:ring-primary flex items-center justify-between p-4 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
            >
              <div>
                <p className="text-foreground font-medium">{tenant.name}</p>
                {tenant.cnpj && (
                  <p className="text-muted-foreground text-sm">{tenant.cnpj}</p>
                )}
              </div>
              <span className="text-muted-foreground text-sm">Ver empresa →</span>
            </Link>
          ))
        )}
      </div>
    </Container>
  );
}
