import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  approveProfileAction,
  configureDpsSeriesAction,
  createProfileDraftAction,
  registerAuthorizationAction,
  revokeAuthorizationAction,
  saveFiscalSettingsAction,
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
import { toIsoDate } from "@/lib/reports/period";
import { isWjbAiEnabled } from "@/lib/wjb-ai/config";
import { listFiscalSetup } from "@/lib/wjb-ai/fiscal/admin.repo";
import { formatCents } from "@/lib/wjb-ai/fiscal/labels";
import {
  ENQUADRAMENTOS,
  parseFiscalProfileSettings,
  type FiscalProfileSettings,
  type ReadinessStatus,
} from "@/lib/wjb-ai/fiscal/profile-settings";
import { hasWjbAiPermission } from "@/lib/wjb-ai/permissions";

export const metadata: Metadata = {
  title: "Perfis fiscais",
  robots: { index: false, follow: false },
};

const MODEL = {
  wjb_procuracao: "Modelo A: certificado da WJB + procuração do cliente",
  certificado_cliente: "Modelo B: certificado do próprio cliente",
} as Record<string, string>;
const KIND = {
  procuracao: "Procuração",
  certificado_proprio: "Certificado próprio",
  consentimento_assistido: "Consentimento (emissão assistida)",
} as Record<string, string>;
const PROFILE_STATUS = {
  draft: "Rascunho",
  approved: "Aprovado (vigente)",
  archived: "Arquivado",
} as Record<string, string>;
const READY_TONE: Record<
  ReadinessStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  ok: "success",
  atencao: "warning",
  pendente: "neutral",
  bloqueado: "danger",
};
const READY_LABEL: Record<ReadinessStatus, string> = {
  ok: "ok",
  atencao: "atenção",
  pendente: "pendente",
  bloqueado: "bloqueado",
};
// Domínios oficiais (XSD v1.01). Rótulos copiados das anotações do esquema.
const OP_SIMP = {
  "1": "1 - Não optante",
  "2": "2 - Optante MEI",
  "3": "3 - Optante ME/EPP",
};
const TRIB_ISSQN = {
  "1": "1 - Operação tributável",
  "2": "2 - Imunidade",
  "3": "3 - Exportação de serviço",
  "4": "4 - Não incidência",
};
const RET_ISSQN = {
  "1": "1 - Não retido",
  "2": "2 - Retido pelo tomador",
  "3": "3 - Retido pelo intermediário",
};
const REG_ESP = {
  "0": "0 - Nenhum",
  "1": "1 - Ato cooperado",
  "2": "2 - Estimativa",
  "3": "3 - Microempresa municipal",
  "4": "4 - Notário ou registrador",
  "5": "5 - Profissional autônomo",
  "6": "6 - Sociedade de profissionais",
  "9": "9 - Outros",
};

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function Options({
  map,
  empty = "Selecione",
}: {
  map: Record<string, string>;
  empty?: string;
}) {
  return (
    <>
      <option value="">{empty}</option>
      {Object.entries(map).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </>
  );
}

function SettingsFields({
  id,
  s,
  cnpj,
}: {
  id: string;
  s: FiscalProfileSettings | null;
  cnpj: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field id={`enq-${id}`} label="Enquadramento">
        <Select
          id={`enq-${id}`}
          name="enquadramento"
          defaultValue={s?.enquadramento ?? ""}
          required
        >
          <Options map={ENQUADRAMENTOS} />
        </Select>
      </Field>
      <Field id={`dk-${id}`} label="Emitente: tipo de documento">
        <Select
          id={`dk-${id}`}
          name="documentKind"
          defaultValue={s?.emitter.documentKind ?? "CNPJ"}
        >
          <option value="CNPJ">CNPJ</option>
          <option value="CPF">CPF</option>
        </Select>
      </Field>
      <Field
        id={`doc-${id}`}
        label="Emitente: CPF/CNPJ"
        hint="Precisa ser o documento da empresa."
      >
        <Input
          id={`doc-${id}`}
          name="emitterDocument"
          defaultValue={s?.emitter.document ?? cnpj ?? ""}
          required
        />
      </Field>
      <Field id={`mun-${id}`} label="Município emissor (IBGE, 7 dígitos)">
        <Input
          id={`mun-${id}`}
          name="municipalityIbge"
          inputMode="numeric"
          defaultValue={s?.emitter.municipalityIbge ?? ""}
          required
        />
      </Field>
      <Field
        id={`hab-${id}`}
        label="Habilitação no Sistema Nacional confirmada em"
        hint="Deixe vazio se ainda não conferiu."
      >
        <Input
          id={`hab-${id}`}
          name="habilitacaoConfirmadaEm"
          type="date"
          defaultValue={s?.emitter.habilitacaoConfirmadaEm ?? ""}
        />
      </Field>
      <Field
        id={`ctn-${id}`}
        label="Código de tributação nacional (cTribNac, 6 dígitos)"
      >
        <Input
          id={`ctn-${id}`}
          name="cTribNac"
          inputMode="numeric"
          defaultValue={s?.service.cTribNac ?? ""}
          required
        />
      </Field>
      <Field id={`nbs-${id}`} label="Código NBS (opcional, 9 dígitos)">
        <Input
          id={`nbs-${id}`}
          name="cNBS"
          inputMode="numeric"
          defaultValue={s?.service.cNBS ?? ""}
        />
      </Field>
      <Field id={`loc-${id}`} label="Local da prestação (IBGE, 7 dígitos)">
        <Input
          id={`loc-${id}`}
          name="cLocPrestacao"
          inputMode="numeric"
          defaultValue={s?.service.cLocPrestacao ?? ""}
          required
        />
      </Field>
      <Field id={`op-${id}`} label="Situação perante o Simples (opSimpNac)">
        <Select
          id={`op-${id}`}
          name="opSimpNac"
          defaultValue={s?.taxes.opSimpNac ?? ""}
          required
        >
          <Options map={OP_SIMP} />
        </Select>
      </Field>
      <Field id={`reg-${id}`} label="Regime especial (regEspTrib)">
        <Select
          id={`reg-${id}`}
          name="regEspTrib"
          defaultValue={s?.taxes.regEspTrib ?? ""}
          required
        >
          <Options map={REG_ESP} />
        </Select>
      </Field>
      <Field id={`tib-${id}`} label="Tributação do ISSQN (tribISSQN)">
        <Select
          id={`tib-${id}`}
          name="tribISSQN"
          defaultValue={s?.taxes.tribISSQN ?? ""}
          required
        >
          <Options map={TRIB_ISSQN} />
        </Select>
      </Field>
      <Field id={`ret-${id}`} label="Retenção do ISSQN (tpRetISSQN)">
        <Select
          id={`ret-${id}`}
          name="tpRetISSQN"
          defaultValue={s?.taxes.tpRetISSQN ?? ""}
          required
        >
          <Options map={RET_ISSQN} />
        </Select>
      </Field>
      <Field id={`ibs-${id}`} label="IBS/CBS na DPS">
        <Select
          id={`ibs-${id}`}
          name="ibsCbsDecision"
          defaultValue={s?.ibsCbs.decision ?? ""}
          required
        >
          <option value="">Selecione</option>
          <option value="nao_informar">
            Não informar (grupo opcional hoje)
          </option>
          <option value="informar">Informar (exige grupo completo)</option>
        </Select>
      </Field>
      <Field id={`ibsj-${id}`} label="Justificativa da decisão de IBS/CBS">
        <Input
          id={`ibsj-${id}`}
          name="ibsCbsJustification"
          minLength={10}
          defaultValue={s?.ibsCbs.justification ?? ""}
          required
        />
      </Field>
      <Field
        id={`ser-${id}`}
        label="Série da DPS (1 a 49999)"
        hint="Faixa do canal API (FAQ NFS-e 18.1)."
      >
        <Input
          id={`ser-${id}`}
          name="dpsSeries"
          inputMode="numeric"
          defaultValue={s?.dpsSeries ?? ""}
          required
        />
      </Field>
    </div>
  );
}

export default async function AdminNfsePerfisPage() {
  if (!isWjbAiEnabled()) notFound();
  const session = await requireStaffSession();
  const canManage = hasWjbAiPermission(session, "fiscal.profile.manage");
  const canReview = hasWjbAiPermission(session, "fiscal.review");
  const today = toIsoDate(new Date());
  const tenants = await listFiscalSetup(today);

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <Breadcrumb
        items={[
          { label: "Admin WJB", href: "/admin" },
          { label: "NFS-e", href: "/admin/nfse" },
          { label: "Perfis fiscais" },
        ]}
      />
      <h1 className="text-foreground text-2xl font-semibold">
        Perfis fiscais e autorizações
      </h1>
      <NfseAdminNav current="/admin/nfse/perfis" />
      <p className="text-muted-foreground text-sm">
        O cadastro fiscal é definido pelo contador e só vale depois de aprovado
        por quem tem a permissão <code>fiscal_profile.approve</code>. Perfil
        aprovado não muda: crie uma nova versão. Autorizações guardam só
        metadados do certificado e a <strong>referência ao cofre</strong>, nunca
        o arquivo, a chave ou a senha. Os domínios dos campos são os do XSD
        oficial da NFS-e Nacional.
      </p>

      {tenants.map((t) => {
        const approved = t.profiles.find((p) => p.status === "approved");
        const approvedSettings = approved
          ? parseFiscalProfileSettings(approved.service_settings)
          : null;
        return (
          <section
            key={t.id}
            className="border-border flex flex-col gap-5 rounded-md border p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-foreground text-base font-semibold">
                {t.name}
              </h2>
              <Badge tone={t.readiness.ready ? "success" : "warning"}>
                {t.readiness.ready
                  ? "Cadastro pronto (simulação)"
                  : "Cadastro incompleto"}
              </Badge>
            </div>

            <div>
              <h3 className="text-foreground mb-2 text-sm font-semibold">
                Prontidão para emitir
              </h3>
              <ul className="flex flex-col gap-1.5 text-sm">
                {t.readiness.items.map((i, n) => (
                  <li
                    key={`${i.key}-${n}`}
                    className="flex flex-wrap items-start gap-2"
                  >
                    <Badge tone={READY_TONE[i.status]}>
                      {READY_LABEL[i.status]}
                    </Badge>
                    <span className="text-foreground font-medium">
                      {i.label}:
                    </span>
                    <span className="text-muted-foreground min-w-0 break-words">
                      {i.detail}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-2 text-xs">
                Tudo em ok não transmite nada: o envio continua dependendo da
                revisão do contador e, para o governo, de autorização específica
                da WJB.
              </p>
            </div>

            <div>
              <h3 className="text-foreground mb-2 text-sm font-semibold">
                Perfis
              </h3>
              {t.profiles.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum perfil.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {t.profiles.map((p) => {
                    const parsed = parseFiscalProfileSettings(
                      p.service_settings,
                    );
                    const settings = parsed.ok
                      ? parsed.settings
                      : approvedSettings?.ok
                        ? approvedSettings.settings
                        : null;
                    return (
                      <li
                        key={p.id}
                        className="border-border rounded-md border p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>Versão {p.version}</strong>
                          <Badge
                            tone={
                              p.status === "approved" ? "success" : "neutral"
                            }
                          >
                            {PROFILE_STATUS[p.status] ?? p.status}
                          </Badge>
                          <Badge tone={parsed.ok ? "info" : "warning"}>
                            {parsed.ok
                              ? "cadastro fiscal completo"
                              : "cadastro fiscal incompleto"}
                          </Badge>
                          <span className="text-muted-foreground">
                            limite sem revisão{" "}
                            {formatCents(p.max_amount_cents_without_review)}
                          </span>
                        </div>
                        {parsed.ok ? (
                          <p className="text-muted-foreground mt-1">
                            {ENQUADRAMENTOS[parsed.settings.enquadramento]} ·
                            cTribNac {parsed.settings.service.cTribNac} · local{" "}
                            {parsed.settings.service.cLocPrestacao} · série{" "}
                            {String(parsed.settings.dpsSeries).padStart(5, "0")}
                          </p>
                        ) : null}
                        {p.approved_at ? (
                          <p className="text-muted-foreground mt-1">
                            Aprovado por {p.approvedByName} em{" "}
                            {new Date(p.approved_at).toLocaleString("pt-BR")}:{" "}
                            {p.approval_justification}
                          </p>
                        ) : null}
                        {p.status === "draft" && canManage ? (
                          <details className="mt-3">
                            <summary className="text-primary cursor-pointer font-medium">
                              Preencher cadastro fiscal deste rascunho
                            </summary>
                            <div className="mt-3">
                              <AdminActionForm
                                action={saveFiscalSettingsAction.bind(
                                  null,
                                  p.id,
                                )}
                                submitLabel="Salvar cadastro fiscal"
                                resetOnSuccess={false}
                                variant="outline"
                              >
                                <SettingsFields
                                  id={p.id}
                                  s={settings}
                                  cnpj={t.cnpj}
                                />
                              </AdminActionForm>
                            </div>
                          </details>
                        ) : null}
                        {p.status === "draft" ? (
                          <div className="mt-3">
                            <AdminActionForm
                              action={approveProfileAction.bind(null, p.id)}
                              submitLabel="Aprovar perfil"
                            >
                              <Label htmlFor={`just-${p.id}`}>
                                Justificativa da aprovação
                              </Label>
                              <Input
                                id={`just-${p.id}`}
                                name="justification"
                                minLength={10}
                                required
                              />
                            </AdminActionForm>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canManage ? (
                <div className="mt-3">
                  <AdminActionForm
                    action={createProfileDraftAction.bind(null, t.id)}
                    submitLabel="Criar rascunho de perfil"
                    variant="outline"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`max-${t.id}`}>
                          Limite por nota sem revisão (R$)
                        </Label>
                        <Input
                          id={`max-${t.id}`}
                          name="maxAmount"
                          inputMode="decimal"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`ibge-${t.id}`}>
                          Código IBGE do município (opcional)
                        </Label>
                        <Input
                          id={`ibge-${t.id}`}
                          name="municipality"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </AdminActionForm>
                </div>
              ) : null}
            </div>

            <div>
              <h3 className="text-foreground mb-2 text-sm font-semibold">
                Série da DPS
              </h3>
              {t.series.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhuma série configurada.
                </p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {t.series.map((x) => (
                    <li key={`${x.environment}-${x.series}`}>
                      {x.environment === "producao_restrita"
                        ? "Produção restrita"
                        : x.environment === "simulado"
                          ? "Simulação"
                          : x.environment}{" "}
                      · série {String(x.series).padStart(5, "0")} · último
                      número {x.last_number}
                    </li>
                  ))}
                </ul>
              )}
              {canReview ? (
                <div className="mt-3">
                  <AdminActionForm
                    action={configureDpsSeriesAction.bind(null, t.id)}
                    submitLabel="Ativar série"
                    variant="outline"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field id={`senv-${t.id}`} label="Ambiente">
                        <Select
                          id={`senv-${t.id}`}
                          name="environment"
                          defaultValue="simulado"
                        >
                          <option value="simulado">Simulação</option>
                          <option value="producao_restrita">
                            Produção restrita
                          </option>
                        </Select>
                      </Field>
                      <Field id={`sdoc-${t.id}`} label="CPF/CNPJ do emitente">
                        <Input
                          id={`sdoc-${t.id}`}
                          name="emitterDocument"
                          defaultValue={(t.cnpj ?? "").replace(/\D/g, "")}
                          required
                        />
                      </Field>
                      <Field id={`snum-${t.id}`} label="Série (1 a 49999)">
                        <Input
                          id={`snum-${t.id}`}
                          name="series"
                          inputMode="numeric"
                          required
                        />
                      </Field>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Só contador com fiscal_profile.approve para a empresa (ou
                      super admin). Uma série usada nunca é reaproveitada.
                    </p>
                  </AdminActionForm>
                </div>
              ) : null}
            </div>

            <div>
              <h3 className="text-foreground mb-2 text-sm font-semibold">
                Autorizações de emissão
              </h3>
              {t.grants.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhuma autorização registrada.
                </p>
              ) : (
                <ul className="flex flex-col gap-3 text-sm">
                  {t.grants.map((g) => (
                    <li
                      key={g.id}
                      className="border-border rounded-md border p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {g.emission_model
                            ? MODEL[g.emission_model]
                            : (KIND[g.kind] ?? g.kind)}
                        </span>
                        <Badge
                          tone={g.status === "active" ? "success" : "neutral"}
                        >
                          {g.status === "revoked"
                            ? "revogada"
                            : g.status === "expired"
                              ? "vencida"
                              : "ativa"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 break-words">
                        {g.scope} · válida até{" "}
                        {g.valid_until.split("-").reverse().join("/")}
                        {g.certificate_valid_until
                          ? ` · certificado ${g.certificate_kind ?? ""} válido até ${g.certificate_valid_until.split("-").reverse().join("/")}`
                          : ""}
                        {g.certificate_vault_reference
                          ? ` · cofre ${g.certificate_vault_reference}`
                          : ""}
                      </p>
                      {g.revoked_at ? (
                        <p className="text-muted-foreground mt-1">
                          Revogada em{" "}
                          {new Date(g.revoked_at).toLocaleString("pt-BR")}:{" "}
                          {g.revoke_reason}
                        </p>
                      ) : null}
                      {!g.revoked_at && canManage ? (
                        <details className="mt-2">
                          <summary className="text-danger cursor-pointer text-sm">
                            Revogar
                          </summary>
                          <div className="mt-2">
                            <AdminActionForm
                              action={revokeAuthorizationAction.bind(
                                null,
                                g.id,
                              )}
                              submitLabel="Revogar autorização"
                              variant="outline"
                            >
                              <Label htmlFor={`rev-${g.id}`}>
                                Motivo (fica no histórico; a revogação é
                                definitiva)
                              </Label>
                              <Input
                                id={`rev-${g.id}`}
                                name="reason"
                                minLength={10}
                                required
                              />
                            </AdminActionForm>
                          </div>
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canManage ? (
                <details className="mt-3">
                  <summary className="text-primary cursor-pointer text-sm font-medium">
                    Registrar autorização
                  </summary>
                  <div className="mt-3">
                    <AdminActionForm
                      action={registerAuthorizationAction.bind(null, t.id)}
                      submitLabel="Registrar autorização"
                      variant="outline"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field id={`model-${t.id}`} label="Modelo de emissão">
                          <Select
                            id={`model-${t.id}`}
                            name="emissionModel"
                            defaultValue="wjb_procuracao"
                          >
                            <option value="wjb_procuracao">
                              {MODEL.wjb_procuracao}
                            </option>
                            <option value="certificado_cliente">
                              {MODEL.certificado_cliente}
                            </option>
                          </Select>
                        </Field>
                        <Field
                          id={`valid-${t.id}`}
                          label="Autorização válida até"
                        >
                          <Input
                            id={`valid-${t.id}`}
                            name="validUntil"
                            type="date"
                            required
                          />
                        </Field>
                        <Field
                          id={`scope-${t.id}`}
                          label="Escopo"
                          hint="Precisa citar NFS-e."
                        >
                          <Input
                            id={`scope-${t.id}`}
                            name="scope"
                            defaultValue="Emissão de NFS-e Nacional"
                            required
                          />
                        </Field>
                        <Field
                          id={`ev-${t.id}`}
                          label="Onde está a evidência"
                          hint="Ex.: pasta do cliente no drive da WJB. Nunca o arquivo."
                        >
                          <Input id={`ev-${t.id}`} name="evidence" required />
                        </Field>
                        <Field
                          id={`holder-${t.id}`}
                          label="CNPJ/CPF do titular do certificado"
                          hint="Modelo A: CNPJ da WJB que recebeu a procuração. Modelo B: documento do cliente."
                        >
                          <Input
                            id={`holder-${t.id}`}
                            name="holderDocument"
                            required
                          />
                        </Field>
                        <Field
                          id={`ck-${t.id}`}
                          label="Tipo do certificado (modelo B)"
                        >
                          <Select
                            id={`ck-${t.id}`}
                            name="certKind"
                            defaultValue=""
                          >
                            <option value="">-</option>
                            <option value="A1">A1</option>
                            <option value="A3">A3</option>
                          </Select>
                        </Field>
                        <Field
                          id={`cf-${t.id}`}
                          label="Certificado válido de (modelo B)"
                        >
                          <Input
                            id={`cf-${t.id}`}
                            name="certValidFrom"
                            type="date"
                          />
                        </Field>
                        <Field
                          id={`cu-${t.id}`}
                          label="Certificado válido até (modelo B)"
                        >
                          <Input
                            id={`cu-${t.id}`}
                            name="certValidUntil"
                            type="date"
                          />
                        </Field>
                        <Field
                          id={`fp-${t.id}`}
                          label="Impressão digital SHA-256 (modelo B)"
                        >
                          <Input
                            id={`fp-${t.id}`}
                            name="certFingerprint"
                            autoComplete="off"
                          />
                        </Field>
                        <Field
                          id={`vr-${t.id}`}
                          label="Referência ao cofre (modelo B)"
                          hint="Formato vault://..."
                        >
                          <Input
                            id={`vr-${t.id}`}
                            name="vaultReference"
                            autoComplete="off"
                          />
                        </Field>
                      </div>
                      <label className="text-foreground flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="certRequirements"
                          className="mt-1"
                        />
                        <span>
                          Modelo B: conferi que o certificado é ICP-Brasil v3,
                          tem Assinatura Digital + Não Recusa, Autenticação de
                          Cliente e não é de AC.
                        </span>
                      </label>
                    </AdminActionForm>
                  </div>
                </details>
              ) : null}
            </div>
          </section>
        );
      })}
    </Container>
  );
}
