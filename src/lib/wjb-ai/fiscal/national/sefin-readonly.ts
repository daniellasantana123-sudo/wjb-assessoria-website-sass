import { request as httpsRequest } from "node:https";
import { createHash } from "node:crypto";

import type { SigningMaterial } from "@/lib/wjb-ai/fiscal/national/xmldsig";

/**
 * Leitura AUTENTICADA (mTLS) e SOMENTE LEITURA da SEFIN Nacional em produção
 * restrita (Fase 6). Preparada, NÃO executada: a primeira conexão depende de
 * autorização expressa da WJB (doc 31).
 *
 * Travas, todas no código (não em configuração):
 * - hosts: só produção restrita (SEFIN e ADN);
 * - métodos: GET só para documentação (swagger/docs) e HEAD só para
 *   `/dps/{id}` (consulta se a DPS existe, sem efeito fiscal);
 * - qualquer outro método ou caminho é recusado antes de abrir conexão;
 * - exige uma autorização explícita (quem, quando, escopo) E a variável de
 *   runtime WJB_AI_SEFIN_READ_AUTHORIZED=true;
 * - o corpo da resposta nunca vai para log; só tamanho e SHA-256.
 */
export const SEFIN_READONLY_HOSTS = [
  "sefin.producaorestrita.nfse.gov.br",
  "adn.producaorestrita.nfse.gov.br",
] as const;

const DOC_PATH =
  /^\/(?:API\/)?[A-Za-z]*\/?(?:[A-Za-z]+\/)?(?:docs|swagger)(?:\/[\w.\-/]*)?$/i;
const DPS_HEAD_PATH = /^\/(?:API\/)?SefinNacional\/dps\/DPS[0-9A-Z]{42}$/;

export interface ReadAuthorization {
  approvedBy: string; // nome ou papel de quem autorizou (sem documento pessoal)
  approvedAt: string; // AAAA-MM-DD
  scope: "leitura-documentacao-e-consulta";
}

export class SefinReadRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SefinReadRefusedError";
  }
}

export function checkReadOnlyRequest(
  method: string,
  url: URL,
  allowedHosts: readonly string[] = SEFIN_READONLY_HOSTS,
): void {
  if (url.protocol !== "https:") throw new SefinReadRefusedError("Só HTTPS.");
  if (!allowedHosts.includes(url.hostname))
    throw new SefinReadRefusedError(
      `Host fora da lista de produção restrita: ${url.hostname}.`,
    );
  if (method === "GET" && DOC_PATH.test(url.pathname)) return;
  if (method === "HEAD" && DPS_HEAD_PATH.test(url.pathname)) return;
  throw new SefinReadRefusedError(
    `Operação não permitida nesta fase: ${method} ${url.pathname} (só leitura de documentação e HEAD /dps).`,
  );
}

export interface ReadResult {
  status: number;
  contentType: string | null;
  bytes: number;
  sha256: string;
  body: Buffer;
}

export async function sefinReadOnly(input: {
  method: "GET" | "HEAD";
  url: string;
  authorization: ReadAuthorization | null;
  material: SigningMaterial;
  /** Só testes: troca a lista de hosts e a CA confiável. */
  testOverrides?: { allowedHosts: readonly string[]; ca: Buffer };
  timeoutMs?: number;
}): Promise<ReadResult> {
  if (process.env["WJB_AI_SEFIN_READ_AUTHORIZED"] !== "true")
    throw new SefinReadRefusedError(
      "Leitura da SEFIN não autorizada (WJB_AI_SEFIN_READ_AUTHORIZED).",
    );
  const a = input.authorization;
  if (
    !a ||
    a.scope !== "leitura-documentacao-e-consulta" ||
    !a.approvedBy ||
    !/^\d{4}-\d{2}-\d{2}$/.test(a.approvedAt)
  )
    throw new SefinReadRefusedError(
      "Falta a autorização expressa da WJB para a leitura.",
    );
  const url = new URL(input.url);
  checkReadOnlyRequest(input.method, url, input.testOverrides?.allowedHosts);

  const key = input.material.privateKey.export({
    type: "pkcs8",
    format: "pem",
  });
  const cert = `-----BEGIN CERTIFICATE-----\n${input.material.certificateDer
    .toString("base64")
    .replace(/(.{64})/g, "$1\n")}\n-----END CERTIFICATE-----\n`;

  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: input.method,
        key,
        cert,
        ca: input.testOverrides?.ca,
        minVersion: "TLSv1.2",
        headers: { accept: "application/json" },
        timeout: input.timeoutMs ?? 20_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({
            status: res.statusCode ?? 0,
            contentType:
              (res.headers["content-type"] as string | undefined) ?? null,
            bytes: body.length,
            sha256: createHash("sha256").update(body).digest("hex"),
            body,
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}
