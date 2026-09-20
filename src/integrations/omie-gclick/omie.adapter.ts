import "server-only";

import type { OmieClientInput, OmieClientResult, OmieGClickAdapter } from "./types";

const CLIENTES_ENDPOINT = "https://app.omie.com.br/api/v1/geral/clientes/";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Segue a convenção pública documentada da API do Omie (envelope
 * `call`/`app_key`/`app_secret`/`param`, sempre HTTP 200 mesmo em erro —
 * o erro vem no corpo como `faultstring`) — mas **não foi testado contra
 * uma conta Omie real nesta sessão** (nenhuma credencial disponível), mesmo
 * status do adapter Meta WhatsApp quando foi implementado (2026-09-18). Ver
 * `artifacts/wjb-saas-mvp/fase-4/decisions.md` D1 antes de habilitar em
 * produção — validar o formato exato contra a documentação atual do Omie
 * (https://developer.omie.com.br) e/ou uma chamada de teste antes de
 * confiar cegamente no resultado.
 *
 * `codigo_cliente_integracao` carrega o `tenant.id` da WJB — é o campo que
 * o próprio Omie disponibiliza para correlação com um sistema externo,
 * evitando ter que já saber o `codigo_cliente_omie` de antemão.
 */
async function callOmie<T>(appKey: string, appSecret: string, call: string, param: T) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(CLIENTES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call, app_key: appKey, app_secret: appSecret, param: [param] }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null);

    if (!response.ok || !body || typeof body.faultstring === "string") {
      const faultCode = body && typeof body.faultcode === "string" ? body.faultcode : String(response.status);
      return { ok: false as const, faultCode };
    }

    return { ok: true as const, body };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "timeout" : "network-error";
    console.error(`[omie-gclick] falha ao chamar "${call}":`, message);
    return { ok: false as const, faultCode: message };
  } finally {
    clearTimeout(timeout);
  }
}

export function createOmieAdapter(appKey: string, appSecret: string): OmieGClickAdapter {
  return {
    async upsertClient(input: OmieClientInput): Promise<OmieClientResult> {
      const call = input.externalClientId ? "AlterarCliente" : "IncluirCliente";
      const param: Record<string, unknown> = {
        codigo_cliente_integracao: input.externalClientId ? undefined : `wjb-tenant-${input.tenantId}`,
        codigo_cliente_omie: input.externalClientId ? Number(input.externalClientId) : undefined,
        razao_social: input.name,
        cnpj_cpf: input.cnpj ?? undefined,
      };

      const result = await callOmie(appKey, appSecret, call, param);

      if (!result.ok) {
        // Log sanitizado: só o código de erro do Omie, nunca app_key/app_secret/payload completo.
        console.error(`[omie-gclick] "${call}" recusado pela API:`, result.faultCode);
        return { ok: false, error: `omie-${result.faultCode}` };
      }

      const externalClientId =
        typeof result.body?.codigo_cliente_omie === "number"
          ? String(result.body.codigo_cliente_omie)
          : input.externalClientId ?? undefined;

      return { ok: true, externalClientId };
    },
  };
}
