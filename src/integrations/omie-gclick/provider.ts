import "server-only";

import type { OmieClientInput, OmieClientResult, OmieConnectionResult, OmieGClickAdapter } from "./types";

/**
 * BLOCKED_BY_PROVIDER (Fase 6.5 do wjb-saas-mvp, 2026-09-20 - auditoria
 * técnica) - o adapter real construído na Fase 4 chamava
 * `https://app.omie.com.br/api/v1/geral/clientes/` com o envelope
 * `call`/`app_key`/`app_secret`/`param` (`IncluirCliente`/`AlterarCliente`/
 * `ListarClientes`). A documentação oficial (ajuda.omie.com.br, artigos
 * "Omie.G-Click: API" e "Como funcionam as Integrações da G-Click",
 * verificados nesta fase) confirma que **a Omie.G-Click API é um produto
 * separado da API do Omie ERP**, com autenticação própria via um endpoint
 * de "Gerar credenciais" que devolve um Token exigido em todos os demais
 * endpoints - não o par `app_key`/`app_secret` enviado a cada requisição
 * que o adapter da Fase 4 usava. Ou seja: o adapter anterior estava
 * implementando a API errada (Omie ERP, não G-Click).
 *
 * A especificação técnica completa (host real, formato exato do endpoint
 * de credenciais, headers, schemas de request/response) só existe na
 * documentação Postman oficial (documenter.getpostman.com/view/12417251/
 * UV5TFeha), cujo conteúdo é renderizado via JavaScript e não pôde ser
 * lido nesta sessão - ver `artifacts/wjb-saas-mvp/fase-6-5/audit-report.md`
 * e `api-validation.md`. Implementar uma chamada real sem essa
 * confirmação seria inventar payload/endpoint, o que a regra do projeto
 * proíbe explicitamente.
 *
 * Por isso este provider sempre devolve o adapter no-op, independente de
 * qualquer variável de ambiente - não há mais nenhuma leitura de
 * `OMIE_APP_KEY`/`OMIE_APP_SECRET` (nomes que, de qualquer forma,
 * pertenciam ao modelo errado). Reativar a chamada real exige: (1) acesso
 * de fato à documentação técnica Postman ou contato direto com a Omie
 * (ver `omie-contact-checklist.md`), e (2) credenciais reais pra validar
 * contra a API de verdade.
 */
const noopAdapter: OmieGClickAdapter = {
  async upsertClient(input: OmieClientInput): Promise<OmieClientResult> {
    console.log(
      `[omie-gclick:blocked] Implementação real bloqueada (ver fase-6.5/audit-report.md) - cliente do tenant ${input.tenantId} não sincronizado`,
    );
    return { ok: false, error: "blocked-by-provider" };
  },
  async testConnection(): Promise<OmieConnectionResult> {
    return { ok: false, error: "blocked-by-provider" };
  },
};

/**
 * Sempre `false` hoje - não é uma checagem de env var (não há mais
 * nenhuma pra checar), é o estado real da integração: bloqueada até a
 * documentação técnica oficial ser confirmada. Mantido como função (não
 * inline na UI) pra ter um único lugar a mudar quando isso deixar de ser
 * verdade.
 */
export function isOmieConfigured(): boolean {
  return false;
}

export function getOmieGClickAdapter(): OmieGClickAdapter {
  return noopAdapter;
}
