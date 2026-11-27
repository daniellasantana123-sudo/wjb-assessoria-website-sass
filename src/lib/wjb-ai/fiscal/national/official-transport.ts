import "server-only";

import { isOpenGateToken } from "@/lib/wjb-ai/fiscal/national/gate-token";
import { maskDocument } from "@/lib/wjb-ai/fiscal/mask";
import type {
  SefinCallContext,
  SefinEmitResult,
  SefinQueryResult,
  SefinTransport,
} from "@/lib/wjb-ai/fiscal/national/transport";

/**
 * Transporte OFICIAL da SEFIN Nacional, desacoplado da rede (Fase 10B).
 *
 * Não abre conexão sozinho: recebe um `SefinHttpClient`, que no futuro será
 * o cliente mTLS com o certificado do cofre. Nesta fase o único cliente que
 * existe é o FALSO dos testes de contrato, e a fábrica do transporte real
 * (`createMtlsSefinTransport`, em transport.ts) continua recusando. Quem decide
 * se um envio oficial pode acontecer é o portão (`transmission-gate.ts`).
 *
 * O contrato JSON (nomes de campos, códigos HTTP, corpo de erro) está no
 * swagger da SEFIN, que exige certificado e NÃO foi lido. Por isso cada campo
 * está marcado: "confirmado" (fonte oficial pública), "inferido" (dedução a
 * partir de manuais e do FAQ, a conferir) ou "pendente" (sem fonte). O
 * portão recusa enquanto houver campo não confirmado.
 */
export type ContractFieldStatus = "confirmado" | "inferido" | "pendente";

export interface ContractField {
  name: string;
  status: ContractFieldStatus;
  source: string;
}

export const SEFIN_API_CONTRACT = {
  /** URL base de produção restrita (doc 25, 3.1). */
  baseUrl: {
    name: "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional",
    // Fase 10F: a página oficial só publica o endereço do swagger
    // (`/API/SefinNacional/docs/index`); a base da API é DEDUZIDA dele.
    status: "inferido",
    source: "deduzida do swagger em gov.br/nfse > APIs prod. restrita e produção; conferir no swagger autenticado",
  },
  emitPath: {
    name: "/nfse",
    status: "confirmado",
    source: "Manual dos Contribuintes - Emissor Público Nacional API v1.0 (17/03/2025), 1.3.2 a (POST /nfse)",
  },
  dpsPath: {
    name: "/dps/{id}",
    status: "confirmado",
    source: "Manual dos Contribuintes - Emissor Público Nacional API v1.0 (17/03/2025), 1.4.2 a/b (GET e HEAD); FAQ v1.5, 26.4",
  },
  /** Campo do JSON de envio com a DPS assinada em GZip + Base64. */
  requestDpsField: {
    name: "dpsXmlGZipB64",
    status: "inferido",
    source:
      "padrão do campo de eventos `eventoViaXmlGZipBase64` (FAQ v1.5, 17.1); nome exato da DPS só no swagger",
  },
  responseAccessKeyField: {
    name: "chaveAcesso",
    status: "inferido",
    source:
      "nome do campo nos manuais e no leiaute da NFS-e; JSON só no swagger",
  },
  responseNfseField: {
    name: "nfseXmlGZipB64",
    status: "inferido",
    source: "simetria com o envio; só no swagger",
  },
  responseErrorsField: {
    name: "erros",
    status: "pendente",
    source: "formato do corpo de erro não publicado (doc 25, 3.1)",
  },
  errorCodeField: {
    name: "Codigo",
    status: "pendente",
    source: "não publicado",
  },
  errorMessageField: {
    name: "Descricao",
    status: "pendente",
    source: "não publicado",
  },
  httpStatusAuthorized: {
    name: "201",
    status: "pendente",
    source: "códigos HTTP não publicados",
  },
  /** Formato da chave de acesso da NFS-e aceito como autorização. */
  accessKeyPattern: {
    name: "^[0-9]{50}$",
    status: "inferido",
    source:
      "chave de acesso de 50 posições do leiaute da NFS-e; conferir no swagger",
  },
  /** Status HTTP aceitos como REJEIÇÃO definitiva (o resto é indeterminado). */
  rejectionHttpStatuses: {
    name: "400,422",
    status: "pendente",
    source:
      "códigos HTTP não publicados; restrição deliberada (revisão de segurança)",
  },
  /**
   * Eventos (cancelamento e manifestação). Fase 10F: caminho achado no manual
   * oficial (lido localmente, texto extraído do PDF). O JSON do pedido
   * continua só no swagger autenticado (`requestEventField`).
   */
  eventPath: {
    name: "/nfse/{chaveAcesso}/eventos",
    status: "confirmado",
    source: "Manual dos Contribuintes - Emissor Público Nacional API v1.0 (17/03/2025), 1.5.2 a (POST) e b/c/d (GET por chave, tipo e sequencial)",
  },
  /** Fase 10F: consulta da NFS-e pela chave de acesso. */
  nfseQueryPath: {
    name: "/nfse/{chaveAcesso}",
    status: "confirmado",
    source: "Manual dos Contribuintes - Emissor Público Nacional API v1.0 (17/03/2025), 1.3.2 b",
  },
  /** Fase 10F: consulta dos eventos de uma NFS-e. */
  eventQueryPath: {
    name: "/nfse/{chaveAcesso}/eventos/{tipoEvento}/{numSeqEvento}",
    status: "confirmado",
    source: "Manual dos Contribuintes - Emissor Público Nacional API v1.0 (17/03/2025), 1.5.2 b, c e d",
  },
  requestEventField: {
    name: "eventoViaXmlGZipBase64",
    status: "inferido",
    source: "nome citado na FAQ v1.5 (17.1); JSON completo só no swagger",
  },
} as const satisfies Record<string, ContractField>;

export function unconfirmedContractFields(): string[] {
  return Object.entries(SEFIN_API_CONTRACT)
    .filter(([, f]) => f.status !== "confirmado")
    .map(([k]) => k);
}

export interface SefinHttpRequest {
  method: "POST" | "GET" | "HEAD";
  url: URL;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

export interface SefinHttpResponse {
  status: number;
  body: string;
}

/** Futuro cliente mTLS (cofre). Nos testes, um cliente falso sem rede. */
export interface SefinHttpClient {
  readonly kind: "falso-teste" | "mtls";
  send(request: SefinHttpRequest): Promise<SefinHttpResponse>;
}

export class SefinIndeterminateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SefinIndeterminateError";
  }
}

/** Hosts aceitos: SÓ produção restrita. Produção não existe neste código. */
export const OFFICIAL_TRANSPORT_HOSTS = [
  "sefin.producaorestrita.nfse.gov.br",
] as const;

const DPS_ID = /^DPS[0-9A-Z]{42}$/;

/** Mascara sequências que parecem CPF/CNPJ (11 a 14 dígitos). */
function maskDocuments(text: string): string {
  return text.replace(/\d[\d./-]{9,17}\d/g, (m) =>
    m.replace(/\D/g, "").length >= 11 ? maskDocument(m) : m,
  );
}

function safeJson(body: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(body);
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export class OfficialSefinTransport implements SefinTransport {
  readonly environment = "producao_restrita" as const;
  private readonly base: URL;

  constructor(
    private readonly client: SefinHttpClient,
    options: {
      baseUrl?: string;
      timeoutMs?: number;
      contract?: typeof SEFIN_API_CONTRACT;
      /** Comprovante emitido por `requireOpenGate`. */
      gate?: unknown;
    } = {},
  ) {
    // Cliente mTLS REAL só com o comprovante do portão aberto. O cliente falso
    // dos testes não abre rede e não precisa.
    if (client.kind !== "falso-teste" && !isOpenGateToken(options.gate))
      throw new Error(
        "Transporte oficial com cliente real exige o portão de transmissão aberto.",
      );
    this.base = new URL(options.baseUrl ?? SEFIN_API_CONTRACT.baseUrl.name);
    if (this.base.protocol !== "https:")
      throw new Error("Transporte oficial exige HTTPS.");
    if (this.base.port || this.base.username || this.base.password)
      throw new Error(
        "URL do transporte oficial não pode ter porta, usuário ou senha.",
      );
    if (
      !(OFFICIAL_TRANSPORT_HOSTS as readonly string[]).includes(
        this.base.hostname,
      )
    )
      throw new Error(
        `Host não permitido para o transporte oficial: ${this.base.hostname}. Só produção restrita.`,
      );
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.contract = options.contract ?? SEFIN_API_CONTRACT;
  }
  private readonly timeoutMs: number;
  private readonly contract: typeof SEFIN_API_CONTRACT;

  private validKey(key: string) {
    return new RegExp(this.contract.accessKeyPattern.name).test(key);
  }

  private url(path: string) {
    return new URL(this.base.pathname.replace(/\/$/, "") + path, this.base);
  }

  private dpsUrl(dpsId: string) {
    if (!DPS_ID.test(dpsId)) throw new Error("Id de DPS inválido.");
    return this.url(this.contract.dpsPath.name.replace("{id}", dpsId));
  }

  /**
   * Emissão. 2xx com chave = autorizada; 4xx com lista de erros = rejeitada;
   * QUALQUER outra coisa (5xx, timeout, corpo ilegível, 4xx sem erros) é
   * indeterminada: o provedor concilia por consulta e nunca reenvia às cegas.
   */
  async emit(
    dpsXmlGzipBase64: string,
    dpsId: string,
    context: SefinCallContext,
  ): Promise<SefinEmitResult> {
    void context; // o titular vai no certificado do mTLS, não no corpo
    void this.dpsUrl(dpsId);
    const c = this.contract;
    const res = await this.client.send({
      method: "POST",
      url: this.url(c.emitPath.name),
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ [c.requestDpsField.name]: dpsXmlGzipBase64 }),
      timeoutMs: this.timeoutMs,
    });
    const json = safeJson(res.body);
    if (res.status >= 200 && res.status < 300) {
      const key = json?.[c.responseAccessKeyField.name];
      if (typeof key === "string" && this.validKey(key)) {
        const nfse = json?.[c.responseNfseField.name];
        return {
          kind: "authorized",
          accessKey: key,
          nfseXml: typeof nfse === "string" ? nfse : undefined,
        };
      }
      throw new SefinIndeterminateError(
        "Resposta 2xx sem chave de acesso válida.",
      );
    }
    const rejectionStatuses = c.rejectionHttpStatuses.name
      .split(",")
      .map(Number);
    if (rejectionStatuses.includes(res.status)) {
      const raw = json?.[c.responseErrorsField.name];
      const errors = Array.isArray(raw)
        ? raw
            .map((e) => {
              const o = (e ?? {}) as Record<string, unknown>;
              const code = o[c.errorCodeField.name];
              const msg = o[c.errorMessageField.name];
              // Só código oficial (E + 4 dígitos) conta como rejeição; a
              // mensagem pode citar o tomador: documentos são mascarados.
              return typeof code === "string" && /^E\d{4}$/.test(code)
                ? {
                    code,
                    message:
                      typeof msg === "string"
                        ? maskDocuments(msg.slice(0, 500))
                        : "Sem detalhe.",
                  }
                : null;
            })
            .filter((e): e is { code: string; message: string } => !!e)
        : [];
      if (errors.length) return { kind: "rejected", errors };
    }
    throw new SefinIndeterminateError(
      `Resposta sem resultado conclusivo (HTTP ${res.status}).`,
    );
  }

  async dpsExists(dpsId: string): Promise<boolean> {
    const res = await this.client.send({
      method: "HEAD",
      url: this.dpsUrl(dpsId),
      headers: {},
      timeoutMs: this.timeoutMs,
    });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    throw new SefinIndeterminateError(`HEAD /dps respondeu ${res.status}.`);
  }

  async accessKeyForDps(dpsId: string): Promise<string | null> {
    const res = await this.client.send({
      method: "GET",
      url: this.dpsUrl(dpsId),
      headers: { accept: "application/json" },
      timeoutMs: this.timeoutMs,
    });
    // 403/404: o titular não é ator da nota (ou ela não existe) -> conciliação.
    if (res.status === 403 || res.status === 404) return null;
    if (res.status >= 200 && res.status < 300) {
      const key = safeJson(res.body)?.[
        this.contract.responseAccessKeyField.name
      ];
      return typeof key === "string" && this.validKey(key) ? key : null;
    }
    throw new SefinIndeterminateError(`GET /dps respondeu ${res.status}.`);
  }

  async queryNfse(accessKey: string): Promise<SefinQueryResult> {
    if (!this.validKey(accessKey)) throw new Error("Chave de acesso inválida.");
    const res = await this.client.send({
      method: "GET",
      url: this.url(this.contract.nfseQueryPath.name.replace("{chaveAcesso}", accessKey)),
      headers: { accept: "application/json" },
      timeoutMs: this.timeoutMs,
    });
    if (res.status === 404) return { found: false };
    if (res.status >= 200 && res.status < 300) {
      const nfse = safeJson(res.body)?.[this.contract.responseNfseField.name];
      return { found: true, nfseXml: typeof nfse === "string" ? nfse : undefined };
    }
    // 403 (titular não é ator), 5xx, tempo esgotado: nada é concluído.
    throw new SefinIndeterminateError(`GET /nfse respondeu ${res.status}.`);
  }
}
