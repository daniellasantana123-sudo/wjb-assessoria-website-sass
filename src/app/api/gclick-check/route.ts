import { NextResponse } from "next/server";

import { getGClickConfig } from "@/integrations/omie-gclick/config";
import {
  getOmieGClickAdapter,
  isOmieConfigured,
} from "@/integrations/omie-gclick/provider";

/**
 * **ENDPOINT TEMPORÁRIO** - republicado em 2026-09-23 só pra validar a
 * rotação das credenciais do G-Click, já que não há acesso ao log do
 * servidor em produção e todas as telas que exercitam a integração estão
 * atrás do gate do SaaS. Remover logo em seguida.
 *
 * Versão mínima desta vez: apenas status e booleanos. Não lista
 * visibilidades/grupos (isso já foi resolvido) nem devolve credencial.
 *
 * O lugar definitivo desta checagem é o botão de teste de conexão em
 * `/admin/integracoes` (`omie-connection-test.tsx`), que passa a ficar
 * acessível quando a Plataforma SaaS for aberta.
 */
export async function GET() {
  const config = getGClickConfig();
  const adapter = getOmieGClickAdapter();

  return NextResponse.json({
    mode: config.mode,
    realIntegrationEnabled: config.realIntegrationEnabled,
    clientIdPresent: Boolean(config.clientId),
    clientSecretPresent: Boolean(config.clientSecret),
    configured: isOmieConfigured(),
    health: await adapter.healthCheck(),
    capabilities: adapter.getCapabilities(),
  });
}
