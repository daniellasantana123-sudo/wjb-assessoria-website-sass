import "server-only";

import type { GClickConfig } from "../config";
import type { CreateExternalPreTaskInput, ExternalTask } from "../types";

/**
 * GClickTaskMapper - schema real confirmado em 2026-09-23 pela coleção
 * Postman oficial. "Listar tarefas" e "Criar pré-tarefa" (v2) são
 * públicos; a variante com tag (`POST /tarefas/preTarefas`, v1) é
 * `partner_only` e continua fora da implementação.
 */

export interface GClickPreTaskPayload {
  departamentoId: number;
  assunto: string;
  andamento: string;
  clienteId?: string;
}

/**
 * Obrigatórios: `departamentoId`, `assunto`, `andamento`. Devolve `null`
 * quando `departamentoId` não está configurado (`GCLICK_DEPARTAMENTO_ID`)
 * - sem ele a API recusaria, e chutar um id criaria tarefa no
 * departamento errado, que é pior que falhar.
 */
export function toCreatePreTaskPayload(
  input: CreateExternalPreTaskInput,
  config: GClickConfig,
): GClickPreTaskPayload | null {
  const departamentoId = config.account.departamentoId;
  if (departamentoId === null) return null;

  return {
    departamentoId,
    assunto: input.title,
    // `andamento` é obrigatório: sem descrição, repete o assunto em vez de
    // mandar string vazia (que a API recusaria).
    andamento: input.description ?? input.title,
    clienteId: input.clientExternalId,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Status documentados (A=Aberto, S=Aguardando/Solicitado, X=Cancelado,
 * C=Concluído, D=Dispensado, F=Finalizado, E=Retificando, O=Retificado,
 * P=Solicitado externo). Mantidos como vêm - o contrato interno declara
 * `status: string` justamente pra não perder informação numa tradução
 * com perda.
 */
export function fromExternalPayload(payload: unknown): ExternalTask {
  const raw = (payload ?? {}) as Record<string, unknown>;

  return {
    externalId: raw.id !== undefined && raw.id !== null ? String(raw.id) : "",
    clientExternalId:
      raw.clienteId !== undefined && raw.clienteId !== null
        ? String(raw.clienteId)
        : null,
    title: asString(raw.nome) ?? asString(raw.assunto) ?? "",
    status: asString(raw.status) ?? "",
    dueDate: asString(raw.dataVencimento) ?? asString(raw.dataMeta),
  };
}
