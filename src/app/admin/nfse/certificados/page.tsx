import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { blockCertificateAction } from "@/actions/wjb-ai-admin";
import { StepUpNotice } from "@/components/auth/step-up-notice";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AdminActionForm } from "@/components/wjb-ai/admin/admin-action-form";
import { NfseAdminNav } from "@/components/wjb-ai/admin/nfse-admin-nav";
import { SimulationNotice } from "@/components/wjb-ai/fiscal-status-badge";
import { requireStaffSession } from "@/lib/auth/dal";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import {
  daysUntilExpiry,
  EXPIRY_MILESTONES,
  expiryMilestone,
} from "@/lib/wjb-ai/fiscal/certificate-lifecycle";
import { loadCertificateRegistryView } from "@/lib/wjb-ai/fiscal/certificate-lifecycle.repo";

export const metadata: Metadata = {
  title: "Certificados digitais",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  ativo: "Ativo",
  substituido: "Substituído",
  bloqueado: "Bloqueado",
};
const REASON_LABEL: Record<string, string> = {
  comprometido: "Comprometido",
  revogado: "Revogado",
  substituido: "Substituído (rotação)",
  bloqueado: "Bloqueado",
};
/** Impressão digital abreviada: começo e fim bastam para conferir. */
const shortFp = (fp: string) => `${fp.slice(0, 8)}…${fp.slice(-8)}`;
const dateBr = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default async function AdminNfseCertificadosPage() {
  if (!isWjbAiEnabled()) notFound();
  const session = await requireStaffSession();
  const isSuperAdmin = session.staffRole === "super_admin";
  const view = await loadCertificateRegistryView();
  const now = new Date();

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Admin WJB", href: "/admin" },
          { label: "NFS-e", href: "/admin/nfse" },
          { label: "Certificados" },
        ]}
      />
      <StepUpNotice next="/admin/nfse/certificados" />
      <SimulationNotice audience="equipe" />
      <h1 className="text-foreground text-2xl font-semibold">Certificados digitais</h1>
      <NfseAdminNav current="/admin/nfse/certificados" />
      <p className="text-muted-foreground text-sm">
        Só metadados públicos ficam aqui: o arquivo, a chave e a senha ficam no cofre, que ainda não foi
        contratado. Por isso nenhum certificado real pode ser cadastrado nesta fase. Avisos de vencimento
        saem aos {EXPIRY_MILESTONES.join(", ")} dias e no vencimento. Um certificado substituído ou
        bloqueado nunca volta a ser usado. A data de emissão sozinha não comprova que um certificado é
        seguro: o cadastro exige cadeia ICP-Brasil e consulta de revogação reais.
      </p>

      {!view.readable ? (
        <p role="alert" className="border-warning/40 text-warning-text rounded-md border p-4 text-sm">
          O banco recusou a leitura. Confirme a verificação em duas etapas e recarregue.
        </p>
      ) : null}

      <section aria-labelledby="registro" className="border-border rounded-md border">
        <h2 id="registro" className="text-foreground border-border border-b px-4 py-3 text-sm font-semibold">
          Registro
        </h2>
        {view.certificates.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Nenhum certificado registrado.</p>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de certificados">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Titular</th>
                  <th className="px-4 py-2 font-medium">Impressão digital</th>
                  <th className="px-4 py-2 font-medium">Validade</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {view.certificates.map((c) => {
                  const left = daysUntilExpiry(c.validUntil, now);
                  const m = c.status === "ativo" ? expiryMilestone(left) : null;
                  return (
                    <tr key={c.id} className="border-border border-t">
                      <td className="px-4 py-2">{c.role === "wjb" ? "WJB (modelo A)" : (c.tenantName ?? "Empresa cliente")}</td>
                      <td className="px-4 py-2 font-mono text-xs">{shortFp(c.fingerprint)}</td>
                      <td className="px-4 py-2">
                        {dateBr(c.validUntil)}
                        {m !== null ? (
                          <span className={m === 0 || m === 7 ? "text-danger-text ml-2 font-medium" : "text-warning-text ml-2"}>
                            {m === 0 ? "vencido" : `vence em ${left} dia(s)`}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={c.status === "ativo" ? "success" : c.status === "pendente" ? "neutral" : "danger"}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="bloqueios" className="border-border rounded-md border">
        <h2 id="bloqueios" className="text-foreground border-border border-b px-4 py-3 text-sm font-semibold">
          Bloqueios permanentes
        </h2>
        {view.blocklist.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">Nenhuma impressão digital bloqueada.</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {view.blocklist.map((b) => (
              <li key={b.fingerprint} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <span className="font-mono text-xs">{shortFp(b.fingerprint)}</span>
                <Badge tone="danger">{REASON_LABEL[b.reason] ?? b.reason}</Badge>
                <span className="text-muted-foreground">{dateBr(b.blockedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isSuperAdmin ? (
        <section className="border-border rounded-md border p-6">
          <h2 className="text-foreground mb-2 text-sm font-semibold">Bloquear certificado</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Use para um certificado revogado ou exposto. Informe só a impressão digital SHA-256, calculada no
            computador de quem tem o arquivo (script <code>verificar-certificado.mjs</code>). Nunca envie o
            certificado nem a senha. O bloqueio não pode ser desfeito.
          </p>
          <AdminActionForm action={blockCertificateAction} submitLabel="Bloquear permanentemente">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-3">
                <Label htmlFor="fingerprint">Impressão digital SHA-256</Label>
                <Input id="fingerprint" name="fingerprint" required autoComplete="off" spellCheck={false} maxLength={120} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reason">Motivo</Label>
                <Select id="reason" name="reason" required defaultValue="comprometido">
                  <option value="comprometido">Comprometido (exposto)</option>
                  <option value="revogado">Revogado na AC</option>
                  <option value="bloqueado">Outro motivo</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="confirm">Digite BLOQUEAR para confirmar</Label>
                <Input id="confirm" name="confirm" required autoComplete="off" />
              </div>
            </div>
          </AdminActionForm>
        </section>
      ) : null}
    </Container>
  );
}
