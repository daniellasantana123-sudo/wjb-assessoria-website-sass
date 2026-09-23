import "server-only";

import type { ProviderMode } from "./types";

export interface GClickConfig {
  mode: ProviderMode;
  /**
   * `GCLICK_MODE` continha um valor que não é "mock"/"sandbox"/"production"
   * - `mode` já caiu em "mock" (seguro), mas isto sinaliza que o valor não
   * deveria ter sido ignorado silenciosamente (Checkpoint 6.5.1, seção 10:
   * "GCLICK_MODE=abc deve gerar erro de configuração claro"). O factory
   * (`provider.ts`) loga isto como `console.error` - não lança exceção,
   * pra nunca derrubar login/Dashboard/Documentos por um erro de digitação
   * numa env var de uma integração opcional (mesma prioridade de
   * resiliência já estabelecida em toda esta integração).
   */
  modeConfigError: string | null;
  /**
   * Proteção 1 de 2 (Checkpoint 6.5.1, seções 1/2): decide, no factory,
   * se sequer se tenta um provider "sandbox"/"production" - com isto
   * `false` (padrão), qualquer tentativa de sair do modo mock é bloqueada
   * já aqui. Independente da Proteção 2 (`REAL_PROVIDER_IMPLEMENTED`,
   * hardcoded em `http.provider.ts`) - as duas precisam ser verdadeiras
   * pra uma chamada real algum dia acontecer, e hoje nenhuma das duas é.
   */
  realIntegrationEnabled: boolean;
  /** Host oficial, confirmado pela coleção Postman (2026-09-23). Sobrescrevível por `GCLICK_BASE_URL`. */
  baseUrl: string;
  /** Gerado em Configurações > Integrações & API > Aplicações, no painel do G-Click. */
  clientId: string | undefined;
  /** Idem. Secret - nunca logar, nunca expor em resposta de API. */
  clientSecret: string | undefined;
  timeoutMs: number;
  /**
   * Valores específicos da conta da WJB no G-Click - não dá pra inferir da
   * documentação, e inventá-los faria a API recusar o cadastro. Listáveis
   * por `GET /visibilidades` e `GET /grupos` depois de autenticar.
   */
  account: {
    /** Obrigatório pra `POST /clientes`. Vazio = criação de cliente indisponível. */
    visibilidadeIds: number[];
    /** Opcional na API. */
    grupoIds: number[];
    /** "FIXO" ou "EVENTUAL" - regra de negócio da WJB, não da API. */
    clienteTipo: "FIXO" | "EVENTUAL";
    /** Obrigatório pra `POST /v2/tarefas/preTarefas`. `GET /departamentos` é partner_only, então sai da tela do G-Click. */
    departamentoId: number | null;
    /** Identificador do sistema integrador, gravado em `sistema` no cadastro do cliente. */
    sistema: string;
  };
}

/** "1,2, 3" -> [1, 2, 3]. Ignora vazios e valores não numéricos em vez de quebrar. */
function parseIdList(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function parseMode(raw: string | undefined): {
  mode: ProviderMode;
  modeConfigError: string | null;
} {
  if (raw === undefined || raw === "" || raw === "mock") {
    return { mode: "mock", modeConfigError: null };
  }
  if (raw === "sandbox" || raw === "production") {
    return { mode: raw, modeConfigError: null };
  }
  return {
    mode: "mock",
    modeConfigError: `GCLICK_MODE="${raw}" não é válido (use "mock", "sandbox" ou "production") - caindo em "mock" por segurança.`,
  };
}

function parseTimeout(raw: string | undefined): number {
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_000;
}

export function getGClickConfig(): GClickConfig {
  const { mode, modeConfigError } = parseMode(process.env.GCLICK_MODE);
  return {
    mode,
    modeConfigError,
    realIntegrationEnabled:
      process.env.GCLICK_REAL_INTEGRATION_ENABLED === "true",
    baseUrl: process.env.GCLICK_BASE_URL || "https://api.gclick.com.br",
    clientId: process.env.GCLICK_CLIENT_ID || undefined,
    clientSecret: process.env.GCLICK_CLIENT_SECRET || undefined,
    timeoutMs: parseTimeout(process.env.GCLICK_TIMEOUT_MS),
    account: {
      visibilidadeIds: parseIdList(process.env.GCLICK_VISIBILIDADE_IDS),
      grupoIds: parseIdList(process.env.GCLICK_GRUPO_IDS),
      clienteTipo:
        process.env.GCLICK_CLIENTE_TIPO === "EVENTUAL" ? "EVENTUAL" : "FIXO",
      departamentoId:
        parseIdList(process.env.GCLICK_DEPARTAMENTO_ID)[0] ?? null,
      sistema: process.env.GCLICK_SISTEMA || "WJB Assessoria Contábil",
    },
  };
}
