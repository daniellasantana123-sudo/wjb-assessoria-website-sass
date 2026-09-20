import "server-only";

import type { CreateExternalClientInput, ExternalClient, UpdateExternalClientInput } from "../types";

/**
 * GClickClientMapper (seção 34 do prompt da Fase 6.5) - esqueleto.
 * Nenhuma função aqui é chamada por `GClickHttpProvider` ainda, porque
 * não há payload real (request ou response) pra traduzir - o schema
 * técnico da G-Click não está confirmado nesta sessão. Implementar o
 * corpo real destas funções é o único trabalho necessário quando a
 * especificação chegar - nenhuma outra camada (Server Actions, UI,
 * banco) deveria precisar mudar.
 *
 * TODO_GCLICK_VALIDATION - todo nome de campo abaixo é hipotético, só pra
 * documentar a FORMA da tradução, nunca os nomes reais.
 */

/** Modelo interno -> payload de criação na G-Click. */
export function toCreatePayload(input: CreateExternalClientInput): never {
  void input;
  throw new Error(
    "GClickClientMapper.toCreatePayload: schema de request não confirmado (TODO_GCLICK_VALIDATION).",
  );
}

/** Modelo interno -> payload de atualização na G-Click. */
export function toUpdatePayload(input: UpdateExternalClientInput): never {
  void input;
  throw new Error(
    "GClickClientMapper.toUpdatePayload: schema de request não confirmado (TODO_GCLICK_VALIDATION).",
  );
}

/** Resposta da G-Click -> modelo interno (`ExternalClient`). */
export function fromExternalPayload(payload: unknown): ExternalClient {
  void payload;
  throw new Error(
    "GClickClientMapper.fromExternalPayload: schema de response não confirmado (TODO_GCLICK_VALIDATION).",
  );
}
