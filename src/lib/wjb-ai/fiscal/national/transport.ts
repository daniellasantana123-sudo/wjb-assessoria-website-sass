/**
 * Transporte HTTP do conector SEFIN Nacional. Operações documentadas no
 * Manual de Contribuintes - Emissor Público API v1.2 (out/2025):
 *   POST /nfse            emissão SÍNCRONA a partir da DPS (rejeição ou NFS-e)
 *   GET  /nfse/{chave}    consulta NFS-e
 *   HEAD /dps/{id}        informa se a DPS já gerou NFS-e
 *   GET  /dps/{id}        devolve a chave de acesso (só para atores da nota)
 *
 * Os NOMES dos campos JSON, o esquema de erro e os códigos HTTP exatos estão
 * no swagger, que exige certificado e ainda não foi lido. Por isso este tipo
 * descreve o contrato em termos de domínio, e só o transporte SIMULADO existe.
 */
export interface SefinEmitResult {
  kind: "authorized" | "rejected";
  accessKey?: string;
  nfseXml?: string;
  errors?: { code: string; message: string }[];
}

export interface SefinTransport {
  readonly environment: "simulado" | "producao_restrita" | "producao";
  /** Corpo: XML da DPS assinado, compactado em GZip e codificado em Base64. */
  emit(dpsXmlGzipBase64: string, dpsId: string): Promise<SefinEmitResult>;
  dpsExists(dpsId: string): Promise<boolean>;
  accessKeyForDps(dpsId: string): Promise<string | null>;
}

export class TransportNotAvailableError extends Error {}

/**
 * Transporte real (mTLS com certificado ICP-Brasil + assinatura XMLDSig).
 * Bloqueado de propósito nesta fase: exige cofre de certificados, leitura do
 * swagger com certificado legítimo e autorização expressa.
 */
export function createMtlsSefinTransport(): SefinTransport {
  throw new TransportNotAvailableError(
    "Transporte oficial da SEFIN Nacional não habilitado: requer cofre de certificados, swagger conferido e autorização (doc 24).",
  );
}
