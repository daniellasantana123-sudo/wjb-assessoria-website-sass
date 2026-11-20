import { gunzipSync } from "node:zlib";

import type {
  SefinEmitResult,
  SefinTransport,
} from "@/lib/wjb-ai/fiscal/national/transport";

/**
 * Transporte SIMULADO que reproduz as regras oficiais relevantes para o
 * conector, sem rede e sem certificado:
 * - E0014 (Anexo I, regra 145): a mesma DPS (série+número+município+CNPJ/CPF)
 *   não gera segunda NFS-e - o reenvio é REJEITADO;
 * - recepção (Anexo I, RN_RECEPCAO_DPS 10-11): Base64/GZip inválido ou XML
 *   mal formado são rejeitados;
 * - HEAD/GET /dps/{id} respondem se a DPS já gerou nota.
 * `failNextEmitWithTimeout` simula a resposta perdida: a nota é gerada do
 * lado do "governo", mas o chamador recebe um erro.
 */
export class SimulatedSefinTransport implements SefinTransport {
  readonly environment = "simulado" as const;
  private readonly generated = new Map<string, string>();
  private seq = 0;
  emitCalls = 0;
  failNextEmitWithTimeout = false;

  async emit(
    dpsXmlGzipBase64: string,
    dpsId: string,
  ): Promise<SefinEmitResult> {
    this.emitCalls++;
    let xml: string;
    try {
      xml = gunzipSync(Buffer.from(dpsXmlGzipBase64, "base64")).toString(
        "utf8",
      );
    } catch {
      return {
        kind: "rejected",
        errors: [
          {
            code: "RECEPCAO-10",
            message: "Falha na descompactação da base 64 (simulado).",
          },
        ],
      };
    }
    if (!xml.includes(`Id="${dpsId}"`)) {
      return {
        kind: "rejected",
        errors: [
          {
            code: "E0004",
            message:
              "Identificador da DPS difere da concatenação dos campos (simulado).",
          },
        ],
      };
    }
    if (this.generated.has(dpsId)) {
      return {
        kind: "rejected",
        errors: [
          {
            code: "E0014",
            message: "DPS já gerou NFS-e anteriormente (simulado).",
          },
        ],
      };
    }
    this.seq++;
    const accessKey = `SIMULADO${String(this.seq).padStart(42, "0")}`;
    this.generated.set(dpsId, accessKey);
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

  async accessKeyForDps(dpsId: string): Promise<string | null> {
    return this.generated.get(dpsId) ?? null;
  }
}
