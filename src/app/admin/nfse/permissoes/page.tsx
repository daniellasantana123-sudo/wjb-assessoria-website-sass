import type { Metadata } from "next";
import { SimulationNotice } from "@/components/wjb-ai/fiscal-status-badge";
import { notFound } from "next/navigation";

import {
  grantApproverAction,
  revokeApproverAction,
} from "@/actions/wjb-ai-admin";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AdminActionForm } from "@/components/wjb-ai/admin/admin-action-form";
import { NfseAdminNav } from "@/components/wjb-ai/admin/nfse-admin-nav";
import { requireStaffSession } from "@/lib/auth/dal";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { listApproverGrants } from "@/lib/wjb-ai/fiscal/admin.repo";
import { StepUpNotice } from "@/components/auth/step-up-notice";

export const metadata: Metadata = {
  title: "Permissão de aprovação fiscal",
  robots: { index: false, follow: false },
};

export default async function AdminNfsePermissoesPage() {
  if (!isWjbAiEnabled()) notFound();
  const session = await requireStaffSession();
  const isSuperAdmin = session.staffRole === "super_admin";
  const { grants, contadores, tenants } = await listApproverGrants();

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Admin WJB", href: "/admin" },
          { label: "NFS-e", href: "/admin/nfse" },
          { label: "Permissão de aprovação" },
        ]}
      />
      <StepUpNotice next="/admin/nfse/permissoes" />
      <SimulationNotice audience="equipe" />
      <h1 className="text-foreground text-2xl font-semibold">
        Permissão de aprovação de perfil fiscal
      </h1>
      <NfseAdminNav current="/admin/nfse/permissoes" />
      <p className="text-muted-foreground text-sm">
        <code>fiscal_profile.approve</code> só vale para contadores ativos
        expressamente autorizados, para todas as empresas ou uma só. Só o super
        admin concede e revoga; o super admin não aprova perfis. Tudo fica no
        log de auditoria.
      </p>

      {isSuperAdmin ? (
        <section className="border-border rounded-md border p-6">
          <h2 className="text-foreground mb-4 text-sm font-semibold">
            Conceder permissão
          </h2>
          <AdminActionForm action={grantApproverAction} submitLabel="Conceder">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profileId">Contador</Label>
                <Select id="profileId" name="profileId" required>
                  {contadores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || c.email}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenantId">Empresa</Label>
                <Select id="tenantId" name="tenantId" defaultValue="">
                  <option value="">Todas as empresas</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reason">Motivo</Label>
                <Input id="reason" name="reason" minLength={10} required />
              </div>
            </div>
          </AdminActionForm>
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">
          Só o super admin concede ou revoga esta permissão.
        </p>
      )}

      <section className="border-border rounded-md border p-6">
        <h2 className="text-foreground mb-4 text-sm font-semibold">
          Concessões
        </h2>
        {grants.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma concessão.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {grants.map((g) => (
              <li
                key={g.id}
                className="border-border rounded-md border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{g.profileName}</strong> · {g.tenantName}
                  <Badge tone={g.revoked_at ? "neutral" : "success"}>
                    {g.revoked_at ? "Revogada" : "Ativa"}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1">
                  Concedida por {g.grantedByName} em{" "}
                  {new Date(g.granted_at).toLocaleString("pt-BR")}: {g.reason}
                </p>
                {g.revoked_at ? (
                  <p className="text-muted-foreground">
                    Revogada em {new Date(g.revoked_at).toLocaleString("pt-BR")}
                    : {g.revoke_reason}
                  </p>
                ) : null}
                {isSuperAdmin && !g.revoked_at ? (
                  <div className="mt-2">
                    <AdminActionForm
                      action={revokeApproverAction.bind(null, g.id)}
                      submitLabel="Revogar"
                      variant="outline"
                    >
                      <Label htmlFor={`rev-${g.id}`}>Motivo da revogação</Label>
                      <Input id={`rev-${g.id}`} name="reason" required />
                    </AdminActionForm>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
