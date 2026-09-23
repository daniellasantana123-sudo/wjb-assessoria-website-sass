import { afterEach, describe, expect, it, vi } from "vitest";

import { getGClickConfig } from "@/integrations/omie-gclick/config";
import {
  createGClickHttpProvider,
  isRealProviderImplemented,
} from "@/integrations/omie-gclick/http.provider";
import type { GClickConfig } from "@/integrations/omie-gclick/config";

/**
 * `GClickHttpProvider` - implementação real, escrita em 2026-09-23 contra
 * a coleção Postman oficial (`docs/integrations/gclick/postman-collection.json`).
 * Antes disso era um esqueleto que bloqueava tudo, e estes testes
 * afirmavam exatamente isso; foram reescritos junto com a implementação.
 *
 * O que continua valendo e é testado aqui: **a Proteção 1 (feature flag)
 * ainda bloqueia sozinha** e nenhuma chamada de rede acontece sem ela.
 */

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** Config completa o bastante pra o provider se considerar configurado. */
function configuredConfig(overrides: Partial<GClickConfig> = {}): GClickConfig {
  const base = getGClickConfig();
  return {
    ...base,
    mode: "production",
    clientId: "id-de-teste",
    clientSecret: "segredo-de-teste",
    ...overrides,
    account: {
      ...base.account,
      visibilidadeIds: [2],
      departamentoId: 4,
      ...(overrides.account ?? {}),
    },
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const TOKEN_BODY = {
  access_token: "token-abc",
  token_type: "bearer",
  expires_in: 86399,
};

describe("GClickHttpProvider - Proteção 1 (feature flag) continua bloqueando", () => {
  it("com a flag desligada, nenhum método chama fetch", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: true,
    });
    await provider.clients.create({
      internalId: "t",
      externalReference: "r",
      name: "n",
      document: "11222333000181",
    });
    await provider.clients.findById("1");
    await provider.clients.list();
    await provider.tasks.list();
    await provider.healthCheck();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("com a flag desligada, o erro cita a env var e o status é 'not_configured'", async () => {
    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: true,
    });
    const result = await provider.clients.list();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROVIDER_NOT_CONFIGURED");
      expect(result.error.message).toContain("GCLICK_REAL_INTEGRATION_ENABLED");
    }
    expect((await provider.healthCheck()).status).toBe("not_configured");
  });

  it("com a flag ligada mas sem credenciais, bloqueia sem chamar rede", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = createGClickHttpProvider(
      configuredConfig({ clientId: undefined, clientSecret: undefined }),
      { blockedByFeatureFlag: false },
    );
    const result = await provider.clients.list();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("GCLICK_CLIENT_ID");
  });

  it("a Proteção 2 deixou de bloquear - a implementação real existe desde 2026-09-23", () => {
    expect(isRealProviderImplemented()).toBe(true);
  });
});

describe("GClickHttpProvider - autenticação OAuth", () => {
  it("busca o token em POST /oauth/token com client_credentials em form-urlencoded", async () => {
    const fetchSpy = vi.fn(async (url: string) =>
      url.endsWith("/oauth/token")
        ? jsonResponse(TOKEN_BODY)
        : jsonResponse({ content: [] }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    await provider.clients.list();

    const [tokenUrl, tokenInit] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(tokenUrl).toBe("https://api.gclick.com.br/oauth/token");
    expect(tokenInit.method).toBe("POST");
    expect(
      String((tokenInit.headers as Record<string, string>)["Content-Type"]),
    ).toContain("application/x-www-form-urlencoded");
    const body = String(tokenInit.body);
    expect(body).toContain("grant_type=client_credentials");
    expect(body).toContain("client_id=id-de-teste");
  });

  it("reaproveita o token entre chamadas (só um POST /oauth/token)", async () => {
    const fetchSpy = vi.fn(async (url: string) =>
      url.endsWith("/oauth/token")
        ? jsonResponse(TOKEN_BODY)
        : jsonResponse({ content: [] }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    await provider.clients.list();
    await provider.clients.list();
    await provider.tasks.list();

    const tokenCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).endsWith("/oauth/token"),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it("manda o token como Bearer nas chamadas seguintes", async () => {
    const fetchSpy = vi.fn(async (url: string) =>
      url.endsWith("/oauth/token")
        ? jsonResponse(TOKEN_BODY)
        : jsonResponse({ content: [] }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    await provider.clients.list();

    const [, init] = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-abc",
    );
  });

  /** Token revogado antes do vencimento previsto - renova uma vez, sem virar laço. */
  it("em 401, renova o token e repete a chamada uma única vez", async () => {
    let dataCalls = 0;
    const fetchSpy = vi.fn(async (url: string) => {
      if (String(url).endsWith("/oauth/token")) return jsonResponse(TOKEN_BODY);
      dataCalls += 1;
      return dataCalls === 1
        ? jsonResponse({ message: "expirado" }, 401)
        : jsonResponse({ content: [] });
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    const result = await provider.clients.list();

    expect(result.ok).toBe(true);
    expect(dataCalls).toBe(2);
    expect(
      fetchSpy.mock.calls.filter(([u]) => String(u).endsWith("/oauth/token")),
    ).toHaveLength(2);
  });

  it("401 persistente vira AUTHENTICATION_ERROR, sem repetir pra sempre", async () => {
    const fetchSpy = vi.fn(async (url: string) =>
      String(url).endsWith("/oauth/token")
        ? jsonResponse(TOKEN_BODY)
        : jsonResponse({}, 401),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    const result = await provider.clients.list();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AUTHENTICATION_ERROR");
  });
});

describe("GClickHttpProvider - clientes e tarefas", () => {
  function mockApi(handler: (url: string, init?: RequestInit) => Response) {
    const spy = vi.fn(async (url: string, init?: RequestInit) =>
      String(url).endsWith("/oauth/token")
        ? jsonResponse(TOKEN_BODY)
        : handler(String(url), init),
    );
    global.fetch = spy as unknown as typeof fetch;
    return spy;
  }

  it("cria cliente com os campos obrigatórios do schema oficial", async () => {
    const spy = mockApi(() =>
      jsonResponse(
        {
          id: 1061,
          nome: "Empresa X",
          inscricao: "11222333000181",
          status: "ATIVO",
          integracao: "tenant-1",
        },
        201,
      ),
    );

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    const result = await provider.clients.create({
      internalId: "tenant-1",
      externalReference: "tenant-1",
      name: "Empresa X",
      document: "11.222.333/0001-81",
    });

    const [url, init] = spy.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.gclick.com.br/clientes");
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      tipoInscricao: "CNPJ",
      inscricao: "11222333000181",
      nome: "Empresa X",
      apelido: "Empresa X",
      tipo: "FIXO",
      visibilidadeIds: [2],
      integracao: "tenant-1",
    });
    expect(payload.dataInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.externalId).toBe("1061");
      expect(result.data.status).toBe("active");
      expect(result.data.internalId).toBe("tenant-1");
    }
  });

  it("recusa criar cliente sem CNPJ/CPF válido, sem chamar a API", async () => {
    const spy = mockApi(() => jsonResponse({}, 201));

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    const result = await provider.clients.create({
      internalId: "t",
      externalReference: "r",
      name: "Sem documento",
      document: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(
      spy.mock.calls.filter(([u]) => String(u).endsWith("/clientes")),
    ).toHaveLength(0);
  });

  it("sem GCLICK_VISIBILIDADE_IDS, create avisa que falta configuração", async () => {
    const provider = createGClickHttpProvider(
      configuredConfig({
        account: { ...configuredConfig().account, visibilidadeIds: [] },
      }),
      { blockedByFeatureFlag: false },
    );
    const result = await provider.clients.create({
      internalId: "t",
      externalReference: "r",
      name: "n",
      document: "11222333000181",
    });

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.message).toContain("GCLICK_VISIBILIDADE_IDS");
  });

  it("findById devolve null em 404, em vez de erro", async () => {
    mockApi(() => jsonResponse({ message: "não encontrado" }, 404));

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    const result = await provider.clients.findById("999");

    expect(result).toEqual({ ok: true, data: null });
  });

  /** A busca é textual: só vale como match o `integracao` exato. */
  it("findByExternalReference ignora vizinhos parecidos da busca textual", async () => {
    mockApi(() =>
      jsonResponse({
        content: [
          { id: 1, integracao: "tenant-10", nome: "Outra" },
          { id: 2, integracao: "tenant-1", nome: "Certa" },
        ],
      }),
    );

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    const result = await provider.clients.findByExternalReference("tenant-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data?.externalId).toBe("2");
  });

  it("list traduz o envelope paginado do Spring", async () => {
    mockApi(() =>
      jsonResponse({
        content: [{ id: 1, nome: "A", status: "ATIVO" }],
        number: 0,
        size: 20,
        totalElements: 37,
      }),
    );

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    const result = await provider.clients.list();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(37);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].name).toBe("A");
    }
  });

  it("cria pré-tarefa em POST /v2/tarefas/preTarefas com os obrigatórios", async () => {
    const spy = mockApi(() =>
      jsonResponse({ id: "4.1", assunto: "Documentos", status: "A" }, 201),
    );

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    const result = await provider.tasks.createPreTask({
      clientExternalId: "1061",
      title: "Documentos",
      description: "Enviar documentos",
    });

    const [url, init] = spy.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.gclick.com.br/v2/tarefas/preTarefas");
    expect(JSON.parse(String(init.body))).toMatchObject({
      departamentoId: 4,
      assunto: "Documentos",
      andamento: "Enviar documentos",
      clienteId: "1061",
    });
    expect(result.ok).toBe(true);
  });

  it("sem GCLICK_DEPARTAMENTO_ID, createPreTask avisa em vez de chutar um departamento", async () => {
    const provider = createGClickHttpProvider(
      configuredConfig({
        account: { ...configuredConfig().account, departamentoId: null },
      }),
      { blockedByFeatureFlag: false },
    );
    const result = await provider.tasks.createPreTask({
      clientExternalId: "1",
      title: "x",
    });

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.message).toContain("GCLICK_DEPARTAMENTO_ID");
  });
});

describe("GClickHttpProvider - erros e capacidades", () => {
  it("mapeia os status HTTP para os códigos internos", async () => {
    const cases: [number, string][] = [
      [400, "VALIDATION_ERROR"],
      [403, "AUTHORIZATION_ERROR"],
      [409, "DUPLICATE"],
      [429, "RATE_LIMITED"],
      [500, "UNAVAILABLE"],
    ];

    for (const [status, code] of cases) {
      global.fetch = vi.fn(async (url: string) =>
        String(url).endsWith("/oauth/token")
          ? jsonResponse(TOKEN_BODY)
          : jsonResponse({ message: "erro" }, status, { "retry-after": "30" }),
      ) as unknown as typeof fetch;

      const provider = createGClickHttpProvider(configuredConfig(), {
        blockedByFeatureFlag: false,
      });
      const result = await provider.clients.list();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(code);
        if (code === "RATE_LIMITED")
          expect(result.error.retryAfterMs).toBe(30_000);
      }
    }
  });

  it("nunca vaza o corpo bruto do provider na mensagem", async () => {
    global.fetch = vi.fn(async (url: string) =>
      String(url).endsWith("/oauth/token")
        ? jsonResponse(TOKEN_BODY)
        : jsonResponse(
            { segredo: "client_secret=abc123", message: "campo inválido" },
            400,
          ),
    ) as unknown as typeof fetch;

    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    const result = await provider.clients.list();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).not.toContain("abc123");
  });

  it("getCapabilities() nunca libera os 2 recursos partner_only", () => {
    const provider = createGClickHttpProvider(configuredConfig(), {
      blockedByFeatureFlag: false,
    });
    const capabilities = provider.getCapabilities();

    expect(capabilities.canReplyActivity).toBe(false);
    expect(capabilities.canCreatePreTaskWithTag).toBe(false);
    // As demais refletem a configuração real da conta.
    expect(capabilities.canCreateClients).toBe(true);
    expect(capabilities.canListClients).toBe(true);
  });

  it("capacidades acompanham o que a conta permite de fato", () => {
    const provider = createGClickHttpProvider(
      configuredConfig({
        account: {
          ...configuredConfig().account,
          visibilidadeIds: [],
          departamentoId: null,
        },
      }),
      { blockedByFeatureFlag: false },
    );
    const capabilities = provider.getCapabilities();

    expect(capabilities.canCreateClients).toBe(false);
    expect(capabilities.canCreatePreTasks).toBe(false);
  });
});
