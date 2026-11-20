import { gzipSync } from "node:zlib";

import type { NormalizedNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import { buildDpsId } from "@/lib/wjb-ai/fiscal/national/dps-id";
import {
  buildDpsXml,
  type Emitter,
  type FiscalParameters,
} from "@/lib/wjb-ai/fiscal/national/dps-xml";
import {
  resolveLayout,
  type LayoutContract,
} from "@/lib/wjb-ai/fiscal/national/layouts";
import type { DpsSigner } from "@/lib/wjb-ai/fiscal/national/signing";
import type {
  SefinCallContext,
  SefinTransport,
} from "@/lib/wjb-ai/fiscal/national/transport";
import type {
  FiscalProvider,
  FiscalProviderHealth,
  SubmissionOutcome,
  SubmissionRequest,
} from "@/lib/wjb-ai/fiscal/provider/types";

/**
 * Número de DPS FIXO por pedido. Regra E0014 (Anexo I, regra 145): a mesma
 * série+número+município+CNPJ/CPF não gera segunda NFS-e. Logo, o reenvio
 * depois de um timeout precisa usar o MESMO número - renumerar criaria nota
 * duplicada. Persistente: `allocate_dps_number` (migration 0027) com
 * `SupabaseDpsNumberAllocator`; aqui fica o contrato.
 */
export interface DpsNumberAllocator {
  numberFor(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<{ series: number; number: number }>;
  existing(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<{ series: number; number: number } | null>;
}

/** Em memória, só para testes. Serializa por empresa como a trava do banco. */
export class InMemoryDpsNumberAllocator implements DpsNumberAllocator {
  private readonly byKey = new Map<
    string,
    { series: number; number: number }
  >();
  private readonly last = new Map<string, number>();
  constructor(private readonly series = 1) {}
  async numberFor(tenantId: string, key: string) {
    const k = `${tenantId}:${key}`;
    const found = this.byKey.get(k);
    if (found) return found;
    const next = (this.last.get(tenantId) ?? 0) + 1;
    this.last.set(tenantId, next);
    const value = { series: this.series, number: next };
    this.byKey.set(k, value);
    return value;
  }
  async existing(tenantId: string, key: string) {
    return this.byKey.get(`${tenantId}:${key}`) ?? null;
  }
}

export interface NationalDeps {
  transport: SefinTransport;
  allocator: DpsNumberAllocator;
  signer: DpsSigner;
  emitterFor(tenantId: string): Promise<Emitter>;
  parametersFor(tenantId: string): Promise<FiscalParameters>;
  /** Titular do certificado que conecta e assina (modelo A: WJB; B: cliente). */
  signerContextFor(tenantId: string): Promise<SefinCallContext>;
  /** Ambiente oficial que o leiaute deve respeitar. */
  layoutEnvironment?: "producao_restrita" | "producao";
  layouts?: readonly LayoutContract[];
  now?: () => Date;
}

/**
 * Conector SEFIN Nacional. Com o transporte simulado, todo resultado sai com
 * `simulated: true`. O transporte real não existe nesta fase.
 */
export class NationalNFSeProvider implements FiscalProvider {
  readonly mode = "mock" as const;
  constructor(private readonly deps: NationalDeps) {}

  private get simulated() {
    return (
      this.deps.transport.environment === "simulado" ||
      this.deps.signer.simulated
    );
  }

  private get env() {
    return this.deps.layoutEnvironment ?? "producao_restrita";
  }

  private layoutAt(date: Date): LayoutContract {
    const local = new Date(date.getTime() - 3 * 3_600_000)
      .toISOString()
      .slice(0, 10);
    return resolveLayout(this.env, local, this.deps.layouts);
  }

  private async dpsIdFor(
    tenantId: string,
    key: string,
    allocate: boolean,
    layout: LayoutContract,
  ): Promise<string | null> {
    const emitter = await this.deps.emitterFor(tenantId);
    const n = allocate
      ? await this.deps.allocator.numberFor(tenantId, key)
      : await this.deps.allocator.existing(tenantId, key);
    if (!n) return null;
    return buildDpsId(
      { ...emitter, series: n.series, number: n.number },
      layout,
    );
  }

  private async authorizedFromExisting(
    dpsId: string,
    ctx: SefinCallContext,
  ): Promise<SubmissionOutcome | null> {
    if (!(await this.deps.transport.dpsExists(dpsId, ctx))) return null;
    const accessKey = await this.deps.transport.accessKeyForDps(dpsId, ctx);
    // HEAD diz que existe, GET não devolve a chave (procurador pode não ser
    // tratado como ator): resultado indeterminado -> conciliação, nunca reenvio.
    return accessKey
      ? {
          status: "AUTORIZADA",
          officialId: accessKey,
          simulated: this.simulated,
        }
      : { status: "RESULTADO_INDETERMINADO", simulated: this.simulated };
  }

  async submitAuthorizedDocument(
    request: SubmissionRequest,
  ): Promise<SubmissionOutcome> {
    const now = this.deps.now?.() ?? new Date();
    const layout = this.layoutAt(now);
    const ctx = await this.deps.signerContextFor(request.tenantId);
    const dpsId = (await this.dpsIdFor(
      request.tenantId,
      request.idempotencyKey,
      true,
      layout,
    ))!;
    // Consulta antes de enviar: a DPS pode já ter virado nota numa tentativa anterior.
    const already = await this.authorizedFromExisting(dpsId, ctx);
    if (already) return already;

    const n = (await this.deps.allocator.existing(
      request.tenantId,
      request.idempotencyKey,
    ))!;
    const xml = buildDpsXml({
      dpsId,
      layout,
      environment: this.env,
      series: n.series,
      number: n.number,
      issuedAt: now,
      emitter: await this.deps.emitterFor(request.tenantId),
      draft: request.draft as NormalizedNfseDraft,
      params: await this.deps.parametersFor(request.tenantId),
    });
    const signed = await this.deps.signer.sign(xml, dpsId);
    let result;
    try {
      result = await this.deps.transport.emit(
        gzipSync(Buffer.from(signed, "utf8")).toString("base64"),
        dpsId,
        ctx,
      );
    } catch {
      // Resposta perdida: o resultado é desconhecido, nunca "rejeitada".
      return { status: "RESULTADO_INDETERMINADO", simulated: this.simulated };
    }
    if (result.kind === "authorized" && result.accessKey) {
      return {
        status: "AUTORIZADA",
        officialId: result.accessKey,
        simulated: this.simulated,
      };
    }
    const errors = result.errors ?? [];
    if (errors.some((e) => e.code === "E0014")) {
      // Duplicidade oficial = a nota JÁ existe: conciliar em vez de rejeitar.
      return (
        (await this.authorizedFromExisting(dpsId, ctx)) ?? {
          status: "RESULTADO_INDETERMINADO",
          simulated: this.simulated,
        }
      );
    }
    const first = errors[0] ?? {
      code: "SEM-CODIGO",
      message: "Rejeição sem detalhe.",
    };
    return {
      status: "REJEITADA",
      rejectionCode: first.code,
      message: first.message,
      simulated: this.simulated,
    };
  }

  /** Consulta pelo pedido (tenant + chave) sem nunca alocar número novo. */
  async getSubmissionStatus(
    idempotencyKey: string,
    tenantId?: string,
  ): Promise<SubmissionOutcome | null> {
    if (!tenantId) return null;
    const layout = this.layoutAt(this.deps.now?.() ?? new Date());
    const dpsId = await this.dpsIdFor(tenantId, idempotencyKey, false, layout);
    if (!dpsId) return null;
    return this.authorizedFromExisting(
      dpsId,
      await this.deps.signerContextFor(tenantId),
    );
  }

  async getProviderHealth(): Promise<FiscalProviderHealth> {
    return { mode: "mock", simulated: this.simulated, available: true };
  }
}
