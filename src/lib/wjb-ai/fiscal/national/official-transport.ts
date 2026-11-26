import type {
  SefinCallContext,
  SefinEmitResult,
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
    status: "confirmado",
    source: "gov.br/nfse - documentação técnica (doc 25, 3.1)",
  },
  emitPath: {
    name: "/nfse",
    status: "confirmado",
    source: "Manual de Contribuintes - Emissor Público API (doc 24)",
  },
  dpsPath: {
    name: "/dps/{id}",
    status: "confirmado",
    source: "Manual de Contribuintes - Emissor Público API; FAQ v1.5",
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
    } = {},
  ) {
    this.base = new URL(options.baseUrl ?? SEFIN_API_CONTRACT.baseUrl.name);
    if (this.base.protocol !== "https:")
      throw new Error("Transporte oficial exige HTTPS.");
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
      if (typeof key === "string" && key.length > 0) {
        const nfse = json?.[c.responseNfseField.name];
        return {
          kind: "authorized",
          accessKey: key,
          nfseXml: typeof nfse === "string" ? nfse : undefined,
        };
      }
      throw new SefinIndeterminateError("Resposta 2xx sem chave de acesso.");
    }
    if (res.status >= 400 && res.status < 500) {
      const raw = json?.[c.responseErrorsField.name];
      const errors = Array.isArray(raw)
        ? raw
            .map((e) => {
              const o = (e ?? {}) as Record<string, unknown>;
              const code = o[c.errorCodeField.name];
              const msg = o[c.errorMessageField.name];
              return typeof code === "string"
                ? {
                    code: code.slice(0, 20),
                    message:
                      typeof msg === "string"
                        ? msg.slice(0, 500)
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
      return typeof key === "string" && key ? key : null;
    }
    throw new SefinIndeterminateError(`GET /dps respondeu ${res.status}.`);
  }
}
