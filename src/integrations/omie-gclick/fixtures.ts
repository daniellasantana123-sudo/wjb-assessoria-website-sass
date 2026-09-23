import type { ExternalClient, ExternalTask } from "./types";

/**
 * Dados fictícios pro `MockGClickProvider` e pros testes (seção 30 do
 * prompt da Fase 6.5) - nenhum CNPJ/e-mail/telefone real, nenhum dado de
 * cliente de verdade da WJB. CNPJ no formato válido mas com dígitos
 * claramente de exemplo (`00.000.000/0001-00`-like, mas variado o
 * suficiente pra não colidir entre fixtures).
 */

export const MOCK_CLIENT_DEFAULT: Omit<
  ExternalClient,
  "externalId" | "createdAt" | "updatedAt"
> = {
  internalId: "00000000-0000-0000-0000-000000000001",
  externalReference: "wjb-tenant-mock-default",
  name: "Empresa Exemplo LTDA",
  document: "00.000.000/0001-00",
  status: "active",
  metadata: null,
};

export const MOCK_CLIENT_EXISTING: ExternalClient = {
  internalId: "00000000-0000-0000-0000-000000000002",
  externalId: "9001",
  externalReference: "wjb-tenant-mock-existing",
  name: "Comércio Fictício de Testes ME",
  document: "11.111.111/0001-11",
  status: "active",
  metadata: null,
  createdAt: "2026-01-10T12:00:00.000Z",
  updatedAt: "2026-01-10T12:00:00.000Z",
};

export const MOCK_TASK_OPEN: ExternalTask = {
  externalId: "task-mock-0001",
  clientExternalId: MOCK_CLIENT_EXISTING.externalId,
  title: "Enviar guia de recolhimento (fictício)",
  status: "open",
  dueDate: "2026-10-01",
};

export const MOCK_TASK_COMPLETED: ExternalTask = {
  externalId: "task-mock-0002",
  clientExternalId: MOCK_CLIENT_EXISTING.externalId,
  title: "Conferir documentação societária (fictício)",
  status: "completed",
  dueDate: "2026-08-15",
};

export const MOCK_TASK_FIXTURES: ExternalTask[] = [
  MOCK_TASK_OPEN,
  MOCK_TASK_COMPLETED,
];
