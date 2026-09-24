import type {
  ExternalCatalogItem,
  ExternalClient,
  ExternalPerson,
  ExternalPortfolioItem,
  ExternalTask,
  ExternalTaskActivity,
} from "./types";

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

/**
 * Fixtures dos endpoints de consulta (2026-09-24). Todos marcados como
 * fictícios no próprio texto: aparecem na interface em modo mock, e
 * ninguém deve confundi-los com dado real da WJB.
 */
export const MOCK_PERSON_FIXTURES: ExternalPerson[] = [
  {
    externalId: "user-mock-1",
    name: "Responsável Fictício",
    email: "responsavel.ficticio@example.com",
    role: "Contador",
  },
];

export const MOCK_ACTIVITY_FIXTURES: ExternalTaskActivity[] = [
  {
    externalId: "atv-mock-1",
    name: "Receber documentação do cliente (fictício)",
    order: 1,
    type: "CHECK",
    answered: true,
    answeredBy: "Responsável Fictício",
    answeredAt: "2026-09-10 09:00",
  },
  {
    externalId: "atv-mock-2",
    name: "Transmitir declaração (fictício)",
    order: 2,
    type: "CHECK",
    answered: false,
    answeredBy: null,
    answeredAt: null,
  },
];

export const MOCK_GROUP_FIXTURES: ExternalCatalogItem[] = [
  { externalId: "1", name: "Grupo Fictício A", description: null },
  { externalId: "2", name: "Grupo Fictício B", description: null },
];

export const MOCK_VISIBILITY_FIXTURES: ExternalCatalogItem[] = [
  { externalId: "1", name: "Geral (fictício)", description: null },
];

export const MOCK_FLOW_FIXTURES: ExternalCatalogItem[] = [
  { externalId: "1", name: "Entrada de Cliente (fictício)", description: "S" },
];

export const MOCK_PORTFOLIO_FIXTURES: ExternalPortfolioItem[] = [
  {
    clientExternalId: MOCK_CLIENT_EXISTING.externalId ?? "cli-mock-1",
    name: "Cliente Fictício LTDA",
    document: "12345678000123",
    responsibleName: "Responsável Fictício",
    responsibleEmail: "responsavel.ficticio@example.com",
  },
];
