import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { approveProfileAction, createProfileDraftAction, registerAuthorizationAction } from "@/actions/wjb-ai-admin";
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
import { listFiscalSetup } from "@/lib/wjb-ai/fiscal/admin.repo";
import { formatCents } from "@/lib/wjb-ai/fiscal/labels";
import { hasWjbAiPermission } from "@/lib/wjb-ai/permissions";

export const metadata: Metadata = { title: "Perfis fiscais", robots: { index: false, follow: false } };
const KIND = { procuracao: "Procuração", certificado_proprio: "Certificado próprio", consentimento_assistido: "Consentimento (emissão assistida)" } as Record<string, string>;
const PROFILE_STATUS = { draft: "Rascunho", approved: "Aprovado (vigente)", archived: "Arquivado" } as Record<string, string>;

export default async function AdminNfsePerfisPage() {
  if (!isWjbAiEnabled()) notFound();
  const session = await requireStaffSession();
  const canManage = hasWjbAiPermission(session, "fiscal.profile.manage");
  const tenants = await listFiscalSetup();

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb items={[{ label: "Admin WJB", href: "/admin" }, { label: "NFS-e", href: "/admin/nfse" }, { label: "Perfis fiscais" }]} />
      <h1 className="text-foreground text-2xl font-semibold">Perfis fiscais e autorizações</h1>
      <NfseAdminNav current="/admin/nfse/perfis" />
      <p className="text-muted-foreground text-sm">
        O perfil define o limite por nota que segue sem revisão. Aprovar exige a permissão <code>fiscal_profile.approve</code> para a empresa,
        concedida pelo super admin; depois de aprovado, o perfil não muda: crie uma nova versão. Autorizações registram só a <strong>referência</strong> da evidência, nunca o arquivo, o certificado ou senhas.
      </p>

      {tenants.map((t) => (
        <section key={t.id} className="border-border flex flex-col gap-4 rounded-md border p-6">
          <h2 className="text-foreground text-base font-semibold">{t.name}</h2>

          <div>
            <h3 className="text-foreground mb-2 text-sm font-semibold">Perfis</h3>
            {t.profiles.length === 0 ? <p className="text-muted-foreground text-sm">Nenhum perfil.</p> : (
              <ul className="flex flex-col gap-3">
                {t.profiles.map((p) => (
                  <li key={p.id} className="border-border rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>Versão {p.version}</strong>
                      <Badge tone={p.status === "approved" ? "success" : "neutral"}>{PROFILE_STATUS[p.status] ?? p.status}</Badge>
                      <span className="text-muted-foreground">limite sem revisão {formatCents(p.max_amount_cents_without_review)}{p.municipality_ibge_code ? ` · IBGE ${p.municipality_ibge_code}` : ""}</span>
                    </div>
                    {p.approved_at ? <p className="text-muted-foreground mt-1">Aprovado por {p.approvedByName} em {new Date(p.approved_at).toLocaleString("pt-BR")}: {p.approval_justification}</p> : null}
                    {p.status === "draft" ? (
                      <div className="mt-3">
                        <AdminActionForm action={approveProfileAction.bind(null, p.id)} submitLabel="Aprovar perfil">
                          <Label htmlFor={`just-${p.id}`}>Justificativa da aprovação</Label>
                          <Input id={`just-${p.id}`} name="justification" minLength={10} required />
                        </AdminActionForm>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <div className="mt-3">
                <AdminActionForm action={createProfileDraftAction.bind(null, t.id)} submitLabel="Criar rascunho de perfil" variant="outline">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5"><Label htmlFor={`max-${t.id}`}>Limite por nota sem revisão (R$)</Label><Input id={`max-${t.id}`} name="maxAmount" inputMode="decimal" required /></div>
                    <div className="flex flex-col gap-1.5"><Label htmlFor={`ibge-${t.id}`}>Código IBGE do município (opcional)</Label><Input id={`ibge-${t.id}`} name="municipality" inputMode="numeric" /></div>
                  </div>
                </AdminActionForm>
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="text-foreground mb-2 text-sm font-semibold">Autorizações de emissão</h3>
            {t.grants.length === 0 ? <p className="text-muted-foreground text-sm">Nenhuma autorização registrada.</p> : (
              <ul className="flex flex-col gap-1 text-sm">
                {t.grants.map((g) => (
                  <li key={g.id}>{KIND[g.kind] ?? g.kind} · {g.scope} · válida até {g.valid_until.split("-").reverse().join("/")} · <Badge tone={g.status === "active" ? "success" : "neutral"}>{g.status}</Badge></li>
                ))}
              </ul>
            )}
            {canManage ? (
              <div className="mt-3">
                <AdminActionForm action={registerAuthorizationAction.bind(null, t.id)} submitLabel="Registrar autorização" variant="outline">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5"><Label htmlFor={`kind-${t.id}`}>Tipo</Label>
                      <Select id={`kind-${t.id}`} name="kind" defaultValue="procuracao">{Object.entries(KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
                    <div className="flex flex-col gap-1.5"><Label htmlFor={`valid-${t.id}`}>Válida até</Label><Input id={`valid-${t.id}`} name="validUntil" type="date" required /></div>
                    <div className="flex flex-col gap-1.5"><Label htmlFor={`scope-${t.id}`}>Escopo</Label><Input id={`scope-${t.id}`} name="scope" placeholder="Ex.: emissão de NFS-e de serviços" required /></div>
                    <div className="flex flex-col gap-1.5"><Label htmlFor={`ev-${t.id}`}>Onde está a evidência</Label><Input id={`ev-${t.id}`} name="evidence" placeholder="Ex.: pasta do cliente no drive da WJB" required /></div>
                  </div>
                </AdminActionForm>
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </Container>
  );
}
