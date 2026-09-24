import "server-only";

import type {
  ExternalCatalogItem,
  ExternalPerson,
  ExternalPortfolioItem,
  ExternalTaskActivity,
} from "../types";

/**
 * Mappers dos endpoints de consulta do G-Click (2026-09-24): pessoas,
 * atividades, catálogos e carteira.
 *
 * Todos os nomes de campo vêm das respostas de exemplo da coleção Postman
 * oficial (`docs/integrations/gclick/postman-collection.json`), não de
 * suposição. Dois deles me pegariam se eu tivesse chutado: a busca de
 * catálogo usa `termo` (e não `texto`, como a de clientes), e uma
 * atividade não tem "status" textual - tem `respondida` booleano mais quem
 * respondeu e quando.
 */

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return null;
}

function asRecordArray(payload: unknown): Record<string, unknown>[] {
  // A API alterna entre array puro (responsáveis, convidados, atividades)
  // e envelope paginado do Spring (fluxos, carteira, grupos).
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const content = (payload as { content?: unknown } | null)?.content;
  return Array.isArray(content) ? (content as Record<string, unknown>[]) : [];
}

export function personsFromExternal(payload: unknown): ExternalPerson[] {
  return asRecordArray(payload).map((raw) => ({
    externalId: asString(raw.id) ?? "",
    // `apelido` é o login; só serve de nome quando não há `nome`.
    name: asString(raw.nome) ?? asString(raw.apelido) ?? "",
    email: asString(raw.email),
    // `cargo` vem como objeto ({id, nome, ...}) nesta API, não string.
    role:
      asString((raw.cargo as { nome?: unknown } | null)?.nome) ??
      asString(raw.tipo),
  }));
}

export function activitiesFromExternal(
  payload: unknown,
): ExternalTaskActivity[] {
  return asRecordArray(payload).map((raw) => ({
    externalId: asString(raw.id) ?? "",
    name: asString(raw.nome) ?? "",
    order: typeof raw.ordem === "number" ? raw.ordem : null,
    type: asString(raw.tipo),
    answered: raw.respondida === true,
    answeredBy: asString(raw.respondidaPor),
    answeredAt: asString(raw.respondidaEm),
  }));
}

export function catalogItemsFromExternal(
  payload: unknown,
): ExternalCatalogItem[] {
  return asRecordArray(payload).map((raw) => ({
    externalId: asString(raw.id) ?? "",
    name: asString(raw.nome) ?? "",
    description: asString(raw.descricao) ?? asString(raw.tipo),
  }));
}

export function portfolioFromExternal(
  payload: unknown,
): ExternalPortfolioItem[] {
  return asRecordArray(payload).map((raw) => {
    const client = (raw.cliente ?? {}) as Record<string, unknown>;
    const user = (raw.usuario ?? {}) as Record<string, unknown>;
    return {
      clientExternalId: asString(client.id) ?? "",
      name: asString(client.nome) ?? asString(client.apelido) ?? "",
      // `inscricao` é o CNPJ/CPF do cliente nesta API.
      document: asString(client.inscricao),
      responsibleName: asString(user.nome) ?? asString(user.apelido),
      responsibleEmail: asString(user.email),
    };
  });
}
