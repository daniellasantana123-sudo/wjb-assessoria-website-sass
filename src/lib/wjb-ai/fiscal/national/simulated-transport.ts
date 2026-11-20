import { gunzipSync } from "node:zlib";

import { SimulatedDpsSigner } from "@/lib/wjb-ai/fiscal/national/signing";
import type {
  SefinCallContext,
  SefinEmitResult,
  SefinTransport,
} from "@/lib/wjb-ai/fiscal/national/transport";

/**
 * Transporte SIMULADO que reproduz as regras oficiais relevantes para o
 * conector, sem rede e sem certificado:
 * - RECEPCAO-10: Base64/GZip inválido;
 * - E0004: Id diferente da concatenação dos campos (Anexo I, regra 139);
 * - E0010: série fora da faixa do canal API 00001-49999 (FAQ v1.4, 18.2);
 * - E0717: DPS sem assinatura (FAQ 17.1);
 * - E0718: titular do certificado não é o emitente e não tem procuração
 *   vigente (FAQ 17.2/17.7) - as procurações "da RFB" ficam em `procuracoes`;
 * - E0014: a mesma DPS não gera segunda NFS-e (Anexo I, regra 145);
 * - HEAD /dps aberto a qualquer certificado; GET /dps só para atores, a
 *   menos que `procuradorIsActor` (comportamento ainda NÃO confirmado).
 * `failNextEmitWithTimeout` simula a resposta perdida: a nota é gerada do
 * lado do "governo", mas o chamador recebe um erro.
 */
export class SimulatedSefinTransport implements SefinTransport {
  readonly environment = "simulado" as const;
  private readonly generated = new Map<
    string,
    { accessKey: string; emitter: string; taker: string }
  >();
  private seq = 0;
  emitCalls = 0;
  failNextEmitWithTimeout = false;
  /** Procurações eletrônicas "cadastradas na RFB": `${outorgante}>${procurador}`. */
  readonly procuracoes = new Set<string>();
  procuradorIsActor = false;

  private reject(code: string, message: string): SefinEmitResult {
    return {
      kind: "rejected",
      errors: [{ code, message: `${message} (simulado)` }],
    };
  }

  async emit(
    dpsXmlGzipBase64: string,
    dpsId: string,
    context: SefinCallContext,
  ): Promise<SefinEmitResult> {
    this.emitCalls++;
    let xml: string;
    try {
      xml = gunzipSync(Buffer.from(dpsXmlGzipBase64, "base64")).toString(
        "utf8",
      );
    } catch {
      return this.reject("RECEPCAO-10", "Falha na descompactação da base 64");
    }
    if (!xml.includes(`Id="${dpsId}"`))
      return this.reject(
        "E0004",
        "Identificador da DPS difere da concatenação dos campos",
      );
    const serie = Number(xml.match(/<serie>(\d+)<\/serie>/)?.[1] ?? 0);
    if (serie < 1 || serie > 49999)
      return this.reject(
        "E0010",
        "Série não pertence à faixa do tipo de emissor",
      );
    if (!xml.includes("<Signature"))
      return this.reject("E0717", "Assinatura obrigatória");
    if (!SimulatedDpsSigner.verify(xml))
      return this.reject("E0714", "Assinatura inválida");
    const emitter = xml.match(/<prest><(?:CNPJ|CPF)>([^<]+)<\//)?.[1] ?? "";
    const taker = xml.match(/<toma><(?:CNPJ|CPF)>([^<]+)<\//)?.[1] ?? "";
    const holder = context.certificateHolderDocument;
    if (holder !== emitter && !this.procuracoes.has(`${emitter}>${holder}`))
      return this.reject("E0718", "Assinatura deve ser do emitente da DPS");
    if (this.generated.has(dpsId))
      return this.reject("E0014", "DPS já gerou NFS-e anteriormente");

    this.seq++;
    const accessKey = `SIMULADO${String(this.seq).padStart(42, "0")}`;
    this.generated.set(dpsId, { accessKey, emitter, taker });
    if (this.failNextEmitWithTimeout) {
      this.failNextEmitWithTimeout = false;
      throw new Error(
        "timeout simulado (a nota foi gerada, a resposta se perdeu)",
      );
    }
    return {
      kind: "authorized",
      accessKey,
      nfseXml: `<NFSe><!-- SIMULADO ${accessKey} --></NFSe>`,
    };
  }

  async dpsExists(dpsId: string): Promise<boolean> {
    return this.generated.has(dpsId);
  }

  async accessKeyForDps(
    dpsId: string,
    context: SefinCallContext,
  ): Promise<string | null> {
    const g = this.generated.get(dpsId);
    if (!g) return null;
    const holder = context.certificateHolderDocument;
    const isActor = holder === g.emitter || holder === g.taker;
    const viaProcuracao =
      this.procuradorIsActor && this.procuracoes.has(`${g.emitter}>${holder}`);
    return isActor || viaProcuracao ? g.accessKey : null;
  }
}
