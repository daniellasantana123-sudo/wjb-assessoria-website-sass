import "server-only";

import { createAdminClient } from "@/lib/db/supabase/admin";
import { createClient } from "@/lib/db/supabase/server";
import {
  planExpiryNotices,
  type CertificateLifecycleLookup,
  type CertificateRole,
  type CertificateStatus,
  type ExpiryNotice,
  type RegisteredCertificate,
} from "@/lib/wjb-ai/fiscal/certificate-lifecycle";
import type { CertificateRegistryRepo } from "@/lib/wjb-ai/fiscal/certificate-rotation";

/**
 * Registro do ciclo de vida no banco (migration 0036). Escrita só pelo
 * servidor; leitura da tela do Admin com a sessão do usuário (RLS + MFA no
 * banco). Nunca lê nem grava o material do certificado.
 */
type Row = {
  id: string;
  role: string;
  tenant_id: string | null;
  fingerprint_sha256: string;
  spki_sha256: string | null;
  holder_document: string;
  valid_from: string;
  valid_until: string;
  status: string;
  vault_reference: string;
};
const toCert = (r: Row): RegisteredCertificate & { vaultReference: string } => ({
  id: r.id,
  role: r.role as CertificateRole,
  tenantId: r.tenant_id,
  fingerprint: r.fingerprint_sha256,
  spki: r.spki_sha256 ?? undefined,
  holderDocument: r.holder_document,
  validFrom: r.valid_from,
  validUntil: r.valid_until,
  status: r.status as CertificateStatus,
  vaultReference: r.vault_reference,
});
const COLUMNS = "id, role, tenant_id, fingerprint_sha256, spki_sha256, holder_document, valid_from, valid_until, status, vault_reference";

/** Consulta feita a cada uso do certificado. Erro = exceção (uso negado). */
export class SupabaseCertificateLifecycle implements CertificateLifecycleLookup {
  async state(fingerprint: string, spki: string) {
    const admin = createAdminClient();
    const [cert, block, keyBlock] = await Promise.all([
      admin.from("fiscal_certificates").select("status, role, tenant_id").eq("fingerprint_sha256", fingerprint).maybeSingle(),
      admin.from("fiscal_certificate_blocklist").select("reason").eq("fingerprint_sha256", fingerprint).maybeSingle(),
      admin.from("fiscal_certificate_key_blocklist").select("reason").eq("spki_sha256", spki).maybeSingle(),
    ]);
    if (cert.error || block.error || keyBlock.error) throw new Error("Registro de certificados indisponível.");
    return {
      registered: !!cert.data,
      status: (cert.data?.status as CertificateStatus | undefined) ?? null,
      blocked: !!block.data || !!keyBlock.data,
      role: (cert.data?.role as CertificateRole | undefined) ?? null,
      tenantId: cert.data?.tenant_id ?? null,
    };
  }
}

export class SupabaseCertificateRegistry implements CertificateRegistryRepo {
  async insertPending(row: Parameters<CertificateRegistryRepo["insertPending"]>[0]) {
    const { data, error } = await createAdminClient()
      .from("fiscal_certificates")
      .insert({
        role: row.role,
        tenant_id: row.tenantId,
        fingerprint_sha256: row.fingerprint,
        spki_sha256: row.spki ?? null,
        holder_document: row.holderDocument,
        kind: row.kind,
        valid_from: row.validFrom,
        valid_until: row.validUntil,
        vault_reference: row.vaultReference,
        policy_checked_at: row.policyCheckedAt,
        created_by: row.createdBy,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("Falha ao registrar o certificado.");
    return data.id;
  }
  // Revisão B1: erro de leitura vira exceção, nunca "não há ativo".
  async get(id: string) {
    const { data, error } = await createAdminClient().from("fiscal_certificates").select(COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new Error("Registro de certificados indisponível.");
    return data ? toCert(data as Row) : null;
  }
  async getActive(role: CertificateRole, tenantId: string | null) {
    let q = createAdminClient().from("fiscal_certificates").select(COLUMNS).eq("role", role).eq("status", "ativo");
    q = tenantId ? q.eq("tenant_id", tenantId) : q.is("tenant_id", null);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error("Registro de certificados indisponível.");
    return data ? toCert(data as Row) : null;
  }
  async isBlocked(fingerprint: string, spki: string) {
    const admin = createAdminClient();
    const [a, b] = await Promise.all([
      admin.from("fiscal_certificate_blocklist").select("reason").eq("fingerprint_sha256", fingerprint).maybeSingle(),
      admin.from("fiscal_certificate_key_blocklist").select("reason").eq("spki_sha256", spki).maybeSingle(),
    ]);
    if (a.error || b.error) throw new Error("Lista de bloqueio indisponível.");
    return !!a.data || !!b.data;
  }
  async rotate(id: string) {
    const { data, error } = await createAdminClient().rpc("rotate_fiscal_certificate", { p_new: id });
    if (error) throw new Error("Falha na rotação do certificado.");
    return (data as string | null) ?? null;
  }
}

export interface CertificateRegistryView {
  certificates: {
    id: string;
    role: CertificateRole;
    tenantName: string | null;
    fingerprint: string;
    validUntil: string;
    status: CertificateStatus;
  }[];
  blocklist: { fingerprint: string; reason: string; blockedAt: string }[];
  /** false = o banco recusou a leitura (ex.: sessão sem MFA). */
  readable: boolean;
}

/** Tela do Admin: lê com a sessão do usuário (RLS exige equipe + aal2). */
export async function loadCertificateRegistryView(): Promise<CertificateRegistryView> {
  const supabase = await createClient();
  const [certs, blocks] = await Promise.all([
    supabase
      .from("fiscal_certificates")
      .select("id, role, tenant_id, fingerprint_sha256, valid_until, status")
      .order("valid_until", { ascending: true })
      .limit(200),
    supabase
      .from("fiscal_certificate_blocklist")
      .select("fingerprint_sha256, reason, blocked_at")
      .order("blocked_at", { ascending: false })
      .limit(200),
  ]);
  if (certs.error || blocks.error) return { certificates: [], blocklist: [], readable: false };
  const tenantIds = [...new Set((certs.data ?? []).map((r) => r.tenant_id).filter((v): v is string => !!v))];
  const { data: tenants } = tenantIds.length
    ? await supabase.from("tenants").select("id, name").in("id", tenantIds)
    : { data: [] as { id: string; name: string }[] };
  const names = new Map((tenants ?? []).map((t) => [t.id, t.name]));
  return {
    readable: true,
    certificates: (certs.data ?? []).map((r) => {
      return {
        id: r.id,
        role: r.role as CertificateRole,
        tenantName: r.tenant_id ? (names.get(r.tenant_id) ?? null) : null,
        fingerprint: r.fingerprint_sha256,
        validUntil: r.valid_until,
        status: r.status as CertificateStatus,
      };
    }),
    blocklist: (blocks.data ?? []).map((b) => ({
      fingerprint: b.fingerprint_sha256,
      reason: b.reason,
      blockedAt: b.blocked_at,
    })),
  };
}

/**
 * Avisos de vencimento (marcos 90/60/30/15/7/0), entregues uma única vez.
 * O marco é reservado ANTES do envio (a chave primária impede duas
 * execuções simultâneas de avisar em dobro) e liberado se o aviso não for
 * gravado (revisão B4: aviso que não chegou não conta como enviado).
 * Registro indisponível = `unavailable` (o cron informa, não esconde).
 */
export async function deliverExpiryNotices(
  send: (n: ExpiryNotice) => Promise<boolean>,
  now = new Date(),
): Promise<{ delivered: ExpiryNotice[]; failed: number; unavailable: boolean }> {
  const admin = createAdminClient();
  const [certs, sent] = await Promise.all([
    admin.from("fiscal_certificates").select(COLUMNS).eq("status", "ativo").limit(1000),
    admin.from("fiscal_certificate_expiry_notices").select("certificate_id, milestone").limit(10000),
  ]);
  if (certs.error || sent.error) return { delivered: [], failed: 0, unavailable: true };
  const planned = planExpiryNotices(
    (certs.data ?? []).map((r) => toCert(r as Row)),
    new Set((sent.data ?? []).map((x) => `${x.certificate_id}:${x.milestone}`)),
    now,
  );
  const delivered: ExpiryNotice[] = [];
  let failed = 0;
  for (const n of planned) {
    const claim = await admin
      .from("fiscal_certificate_expiry_notices")
      .insert({ certificate_id: n.certificateId, milestone: n.milestone });
    if (claim.error) continue; // outra execução já reservou
    let ok = false;
    try {
      ok = await send(n);
    } catch {
      ok = false;
    }
    if (ok) delivered.push(n);
    else {
      failed++;
      await admin
        .from("fiscal_certificate_expiry_notices")
        .delete()
        .eq("certificate_id", n.certificateId)
        .eq("milestone", n.milestone);
    }
  }
  return { delivered, failed, unavailable: false };
}

/** Bloqueio manual: pela sessão do usuário, para o banco exigir super admin + MFA. */
export async function blockCertificateFingerprint(fingerprint: string, reason: "comprometido" | "revogado" | "bloqueado") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_fiscal_certificate", { p_fingerprint: fingerprint, p_reason: reason });
  return { ok: !error };
}
