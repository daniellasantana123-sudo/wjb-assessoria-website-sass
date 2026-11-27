import { createHash, createHmac } from "node:crypto";

/**
 * Assinatura AWS Signature Version 4 (Fase 10D), sem SDK: só `node:crypto`.
 * Conferida no teste contra o exemplo publicado pela AWS (IAM ListUsers,
 * chave AKIDEXAMPLE, 20150830T123600Z). Nunca registra a chave secreta.
 */
export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

const sha256Hex = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const hmac = (key: Buffer | string, v: string) => createHmac("sha256", key).update(v).digest();

/** RFC 3986, como a AWS exige (inclusive `*`, `'`, `(`, `)` e `!`). */
const uriEncode = (v: string) =>
  encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function amzDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function signAwsRequest(input: {
  method: "GET" | "POST";
  url: URL;
  headers: Record<string, string>;
  body: string;
  region: string;
  service: string;
  credentials: AwsCredentials;
  now: Date;
}): Record<string, string> {
  const date = amzDate(input.now);
  const day = date.slice(0, 8);
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(input.headers).map(([k, v]) => [k.toLowerCase(), v])),
    host: input.url.host,
    "x-amz-date": date,
  };
  if (input.credentials.sessionToken) headers["x-amz-security-token"] = input.credentials.sessionToken;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n].trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = names.join(";");
  const query = [...input.url.searchParams.entries()]
    .map(([k, v]) => [uriEncode(k), uriEncode(v)] as const)
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const canonicalRequest = [
    input.method,
    input.url.pathname.split("/").map(uriEncode).join("/") || "/",
    query,
    canonicalHeaders,
    signedHeaders,
    sha256Hex(input.body),
  ].join("\n");
  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${input.credentials.secretAccessKey}`, day);
  const kSigning = hmac(hmac(hmac(kDate, input.region), input.service), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
