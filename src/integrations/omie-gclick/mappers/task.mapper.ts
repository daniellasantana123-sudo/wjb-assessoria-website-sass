import "server-only";

import type { CreateExternalPreTaskInput, ExternalTask } from "../types";

/**
 * GClickTaskMapper (seção 34 do prompt da Fase 6.5) - esqueleto, mesmo
 * racional de `client.mapper.ts`. "Listar tarefas"/"Criar pré-tarefa" são
 * públicos na documentação oficial (não `partner_only`), mas sem schema
 * técnico confirmado nesta sessão.
 */

export function toCreatePreTaskPayload(input: CreateExternalPreTaskInput): never {
  void input;
  throw new Error(
    "GClickTaskMapper.toCreatePreTaskPayload: schema de request não confirmado (TODO_GCLICK_VALIDATION).",
  );
}

export function fromExternalPayload(payload: unknown): ExternalTask {
  void payload;
  throw new Error(
    "GClickTaskMapper.fromExternalPayload: schema de response não confirmado (TODO_GCLICK_VALIDATION).",
  );
}
