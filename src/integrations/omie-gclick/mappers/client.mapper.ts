import "server-only";

import type { GClickConfig } from "../config";
import type {
  CreateExternalClientInput,
  ExternalClient,
  UpdateExternalClientInput,
} from "../types";

/**
 * GClickClientMapper - tradução entre o modelo interno da WJB e o schema
 * real do G-Click, confirmado em 2026-09-23 pela coleção Postman oficial
 * (`docs/integrations/gclick/postman-collection.json`). Antes disso estas
 * funções eram esqueletos que lançavam `TODO_GCLICK_VALIDATION`.
 *
 * Campos obrigatórios de `POST /clientes`, conforme a documentação:
 * `tipoInscricao`, `inscricao`, `nome`, `apelido`, `tipo`,
 * `visibilidadeIds` e `dataInicio`.
 */

/** Limites de tamanho documentados por campo - cortar aqui evita um 400 previsível. */
const MAX = {
  inscricao: 18,
  nome: 64,
  apelido: 64,
  sistema: 200,
  integracao: 255,
} as const;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * A API aceita CNPJ, CPF, CEI ou SREG. A WJB só envia CNPJ ou CPF, e a
 * escolha sai da contagem de dígitos - 14 é CNPJ, 11 é CPF. Sem documento,
 * não dá pra cadastrar (`inscricao` é obrigatória).
 */
export function toInscricao(
  document: string | null,
): { tipoInscricao: "CNPJ" | "CPF"; inscricao: string } | null {
  const digits = (document ?? "").replace(/\D/g, "");
  if (digits.length === 14) return { tipoInscricao: "CNPJ", inscricao: digits };
  if (digits.length === 11) return { tipoInscricao: "CPF", inscricao: digits };
  return null;
}

/** `yyyy-MM-dd` exigido pelo campo `dataInicio`. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface GClickClientPayload {
  tipoInscricao: string;
  inscricao: string;
  nome: string;
  apelido: string;
  tipo: string;
  visibilidadeIds: number[];
  dataInicio: string;
  grupoIds?: number[];
  sistema?: string;
  integracao?: string;
}

/** Modelo interno -> payload de criação na G-Click. */
export function toCreatePayload(
  input: CreateExternalClientInput,
  config: GClickConfig,
): GClickClientPayload | null {
  const inscricao = toInscricao(input.document);
  if (!inscricao) return null;

  const nome = truncate(input.name, MAX.nome);
  return {
    ...inscricao,
    inscricao: truncate(inscricao.inscricao, MAX.inscricao),
    nome,
    // `apelido` também é obrigatório; sem um "nome fantasia" separado no
    // modelo da WJB, repetir o nome é mais honesto que inventar um.
    apelido: truncate(input.name, MAX.apelido),
    tipo: config.account.clienteTipo,
    visibilidadeIds: config.account.visibilidadeIds,
    dataInicio: today(),
    ...(config.account.grupoIds.length > 0
      ? { grupoIds: config.account.grupoIds }
      : {}),
    sistema: truncate(config.account.sistema, MAX.sistema),
    // `integracao` é o campo nativo de correlação - é aqui que o
    // `externalReference` da WJB vive do lado do G-Click.
    integracao: truncate(input.externalReference, MAX.integracao),
  };
}

/**
 * `PUT /clientes/{id}` recebe o mesmo formato do POST. Como o contrato
 * interno de update é parcial (só `name`/`document`), quem chama precisa
 * passar o cliente atual pra não apagar campo nenhum por omissão.
 */
export function toUpdatePayload(
  input: UpdateExternalClientInput,
  current: GClickClientPayload,
): GClickClientPayload {
  const inscricao =
    input.document !== undefined ? toInscricao(input.document) : null;

  return {
    ...current,
    ...(inscricao ?? {}),
    ...(input.name
      ? {
          nome: truncate(input.name, MAX.nome),
          apelido: truncate(input.name, MAX.apelido),
        }
      : {}),
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Resposta da G-Click -> modelo interno (`ExternalClient`). */
export function fromExternalPayload(
  payload: unknown,
  internalId = "",
): ExternalClient {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const status = asString(raw.status);

  return {
    internalId,
    externalId: raw.id !== undefined && raw.id !== null ? String(raw.id) : null,
    externalReference: asString(raw.integracao) ?? "",
    name: asString(raw.nome) ?? "",
    document: asString(raw.inscricao),
    // A API devolve "ATIVO"/"INATIVO"; qualquer outro valor vira `null` em
    // vez de ser forçado num dos dois.
    status:
      status === "ATIVO" ? "active" : status === "INATIVO" ? "inactive" : null,
    metadata: {
      tipo: raw.tipo ?? null,
      apelido: raw.apelido ?? null,
      grupoIds: raw.grupoIds ?? null,
      visibilidadeIds: raw.visibilidadeIds ?? null,
      sistema: raw.sistema ?? null,
    },
    createdAt: asString(raw.dataInicio),
    updatedAt: null,
  };
}
