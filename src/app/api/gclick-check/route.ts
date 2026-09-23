import { NextResponse } from "next/server";

import { getGClickConfig } from "@/integrations/omie-gclick/config";
import {
  getOmieGClickAdapter,
  isOmieConfigured,
} from "@/integrations/omie-gclick/provider";

/**
 * **ENDPOINT TEMPORÁRIO** (2026-09-23) - existe só pra validar a
 * configuração da integração G-Click em produção, onde não há acesso ao
 * log do servidor. Remover assim que a configuração estiver concluída.
 *
 * Nunca devolve credencial: só status, booleanos e os `id`/`nome` de
 * visibilidades e grupos - que são exatamente os valores que faltam pra
 * preencher `GCLICK_VISIBILIDADE_IDS`/`GCLICK_GRUPO_IDS`, e que a API
 * exige pra cadastrar cliente.
 */
export async function GET() {
  const config = getGClickConfig();
  const adapter = getOmieGClickAdapter();
  const health = await adapter.healthCheck();

  const base = {
    mode: config.mode,
    realIntegrationEnabled: config.realIntegrationEnabled,
    clientIdPresent: Boolean(config.clientId),
    clientSecretPresent: Boolean(config.clientSecret),
    configured: isOmieConfigured(),
    health,
    capabilities: adapter.getCapabilities(),
    account: {
      visibilidadeIds: config.account.visibilidadeIds,
      grupoIds: config.account.grupoIds,
      departamentoId: config.account.departamentoId,
      clienteTipo: config.account.clienteTipo,
    },
  };

  if (health.status !== "available") {
    return NextResponse.json({ ...base, lists: null });
  }

  /**
   * Listagens auxiliares - não fazem parte do contrato do adapter (que só
   * expõe clientes/tarefas), então vão por `fetch` direto aqui mesmo,
   * já que este arquivo é descartável.
   */
  async function listar(path: string) {
    const token = await getToken();
    if (!token) return { error: "sem token" };
    const response = await fetch(`${config.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok)
      return { status: response.status, error: "falha ao listar" };
    const content = Array.isArray(body) ? body : (body?.content ?? []);
    return {
      total: Array.isArray(content) ? content.length : 0,
      itens: (Array.isArray(content) ? content : [])
        .slice(0, 50)
        .map((raw: Record<string, unknown>) => ({
          id: raw.id,
          nome: raw.nome ?? raw.descricao,
        })),
    };
  }

  /** Reaproveita o mesmo fluxo OAuth do provider, sem expor o token na resposta. */
  async function getToken(): Promise<string | null> {
    const response = await fetch(`${config.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId ?? "",
        client_secret: config.clientSecret ?? "",
        grant_type: "client_credentials",
      }),
    });
    const body = await response.json().catch(() => null);
    return typeof body?.access_token === "string" ? body.access_token : null;
  }

  const [visibilidades, grupos] = await Promise.all([
    listar("/visibilidades?size=50&page=0"),
    listar("/grupos?size=50&page=0"),
  ]);

  return NextResponse.json({ ...base, lists: { visibilidades, grupos } });
}
