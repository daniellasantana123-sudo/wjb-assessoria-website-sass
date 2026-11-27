import {
  expiryMilestone,
  type RegisteredCertificate,
} from "@/lib/wjb-ai/fiscal/certificate-lifecycle";
import { categorize } from "@/lib/wjb-ai/fiscal/national/rejection-catalog";

/**
 * Monitoramento da emissão fiscal (Fase 6). Regras puras; os dados vêm do
 * banco (`monitoring.repo.ts`). Cada alerta diz o que fazer, sem dado
 * pessoal (só ids e contagens).
 */
export type AlertSeverity = "critico" | "atencao";
export interface FiscalAlert {
  code:
    | "CERT_EXPIRED"
    | "CERT_EXPIRING"
    | "PROCURACAO_EXPIRED"
    | "PROCURACAO_EXPIRING"
    | "RESULTADO_INDETERMINADO_PARADO"
    | "FILA_DE_ERROS"
    | "REJEICAO_CERTIFICADO"
    | "USO_DE_CERTIFICADO_NEGADO"
    | "CERT_BLOQUEADO_EM_USO";
  severity: AlertSeverity;
  tenantId: string | null;
  refId: string | null;
  message: string;
}

export interface MonitoringInput {
  now: Date;
  grants: {
    id: string;
    tenantId: string;
    kind: string;
    validUntil: string;
    revokedAt: string | null;
    certificateValidUntil: string | null;
  }[];
  requests: {
    id: string;
    tenantId: string;
    status: string;
    updatedAt: string;
    needsIntervention: boolean;
    lastError: string | null;
  }[];
  usageDenied24h: { tenantId: string; reason: string | null }[];
  /** Fase 10C: certificados ATIVOS do registro (migration 0036). */
  registry?: RegisteredCertificate[];
  /** Fase 10C: autorizações cujo certificado está na lista de bloqueio. */
  blockedCertificateGrants?: { id: string; tenantId: string }[];
}

const DAY = 86_400_000;
const STUCK_MINUTES = 30;

function daysUntil(date: string, now: Date) {
  return Math.floor(
    (Date.parse(`${date}T23:59:59-03:00`) - now.getTime()) / DAY,
  );
}

export function evaluateFiscalAlerts(input: MonitoringInput): FiscalAlert[] {
  const alerts: FiscalAlert[] = [];
  for (const g of input.grants) {
    if (g.revokedAt) continue;
    const label = g.kind === "procuracao" ? "PROCURACAO" : null;
    const d = daysUntil(g.validUntil, input.now);
    if (label) {
      if (d < 0)
        alerts.push({
          code: "PROCURACAO_EXPIRED",
          severity: "critico",
          tenantId: g.tenantId,
          refId: g.id,
          message:
            "Procuração vencida: emissões desta empresa ficam bloqueadas até nova procuração.",
        });
      else if (expiryMilestone(d) !== null)
        alerts.push({
          code: "PROCURACAO_EXPIRING",
          severity: "atencao",
          tenantId: g.tenantId,
          refId: g.id,
          message: `Procuração vence em ${d} dia(s) (aviso de ${expiryMilestone(d)} dias): peça a renovação ao cliente na RFB.`,
        });
    }
    if (g.certificateValidUntil) {
      const c = daysUntil(g.certificateValidUntil, input.now);
      if (c < 0)
        alerts.push({
          code: "CERT_EXPIRED",
          severity: "critico",
          tenantId: g.tenantId,
          refId: g.id,
          message:
            "Certificado vencido: renove e cadastre o novo no cofre antes de emitir.",
        });
      else if (expiryMilestone(c) !== null)
        alerts.push({
          code: "CERT_EXPIRING",
          severity: c <= 7 ? "critico" : "atencao",
          tenantId: g.tenantId,
          refId: g.id,
          message: `Certificado vence em ${c} dia(s) (aviso de ${expiryMilestone(c)} dias).`,
        });
    }
  }
  for (const c of input.registry ?? []) {
    if (c.status !== "ativo") continue;
    const left = Math.floor((Date.parse(c.validUntil) - input.now.getTime()) / DAY);
    const m = expiryMilestone(left);
    if (m === null) continue;
    alerts.push({
      code: m === 0 ? "CERT_EXPIRED" : "CERT_EXPIRING",
      severity: m === 0 || m === 7 ? "critico" : "atencao",
      tenantId: c.tenantId,
      refId: c.id,
      message:
        m === 0
          ? `${c.role === "wjb" ? "Certificado da WJB" : "Certificado de cliente"} vencido: faça a rotação antes de emitir.`
          : `${c.role === "wjb" ? "Certificado da WJB" : "Certificado de cliente"} vence em ${left} dia(s) (aviso de ${m} dias).`,
    });
  }
  for (const g of input.blockedCertificateGrants ?? [])
    alerts.push({
      code: "CERT_BLOQUEADO_EM_USO",
      severity: "critico",
      tenantId: g.tenantId,
      refId: g.id,
      message:
        "Autorização aponta para um certificado bloqueado: emissões desta empresa ficam negadas até a rotação.",
    });
  for (const r of input.requests) {
    const ageMin = (input.now.getTime() - Date.parse(r.updatedAt)) / 60_000;
    if (
      ["RESULTADO_INDETERMINADO", "CONCILIACAO_OFICIAL"].includes(r.status) &&
      ageMin >= STUCK_MINUTES
    )
      alerts.push({
        code: "RESULTADO_INDETERMINADO_PARADO",
        severity: "critico",
        tenantId: r.tenantId,
        refId: r.id,
        message: `Pedido com resultado desconhecido há ${Math.round(ageMin)} min: conferir no governo antes de qualquer reenvio.`,
      });
    if (r.needsIntervention)
      alerts.push({
        code: "FILA_DE_ERROS",
        severity: "critico",
        tenantId: r.tenantId,
        refId: r.id,
        message: "Pedido na fila de erros: precisa de intervenção da equipe.",
      });
    const code = r.lastError?.match(/\bE\d{4}\b/)?.[0];
    if (code && ["certificado", "autorizacao"].includes(categorize(code)))
      alerts.push({
        code: "REJEICAO_CERTIFICADO",
        severity: "critico",
        tenantId: r.tenantId,
        refId: r.id,
        message: `Rejeição ${code} ligada a certificado ou procuração: afeta todas as emissões desta empresa.`,
      });
  }
  const denied = new Map<string, number>();
  for (const u of input.usageDenied24h)
    denied.set(u.tenantId, (denied.get(u.tenantId) ?? 0) + 1);
  for (const [tenantId, n] of denied)
    alerts.push({
      code: "USO_DE_CERTIFICADO_NEGADO",
      severity: "atencao",
      tenantId,
      refId: null,
      message: `${n} uso(s) do certificado negado(s) nas últimas 24 h.`,
    });
  return alerts.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "critico" ? -1 : 1,
  );
}
