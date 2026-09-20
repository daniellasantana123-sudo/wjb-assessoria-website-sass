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

export const metadata: Metadata = {
  title: "Empresas",
  robots: { index: false, follow: false },
};

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaffSession();
  const { q } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("tenants")
    .select("id, name, cnpj, status, created_at")
    .order("created_at", { ascending: false });

  // Busca por nome ou CNPJ (Fase 5 do wjb-saas-mvp) - mesmo padrão `?q=` de `/portal/documentos`.
  // `,`/`(`/`)` removidos do termo antes de interpolar - são caracteres de
  // sintaxe do filtro `or` do PostgREST, não dados de busca legítimos aqui.
  const safeQuery = q?.replace(/[,()]/g, "").trim();
  if (safeQuery) query = query.or(`name.ilike.%${safeQuery}%,cnpj.ilike.%${safeQuery}%`);

  const { data: tenants } = await query;

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

      <form method="get" className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="q">Buscar por nome ou CNPJ</Label>
          <Input id="q" name="q" type="search" defaultValue={q ?? ""} />
        </div>
        <button type="submit" className={buttonVariants({ variant: "outline", size: "md" })}>
          Buscar
        </button>
      </form>

      <div className="border-border divide-border divide-y rounded-md border">
        {!tenants || tenants.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">
            {q ? "Nenhuma empresa encontrada para essa busca." : "Nenhuma empresa cadastrada ainda."}
          </p>
        ) : (
          tenants.map((tenant) => (
            <Link
              key={tenant.id}
              href={`/admin/empresas/${tenant.id}`}
              className="hover:bg-muted/30 focus-visible:ring-primary flex items-center justify-between gap-3 p-4 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
            >
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-foreground font-medium">{tenant.name}</p>
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
