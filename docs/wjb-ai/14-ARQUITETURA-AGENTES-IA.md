# 14 - Arquitetura preliminar dos agentes de IA

**Status:** desenho. Nenhum agente de IA foi implementado e nenhum dado foi enviado a provedor externo. O provedor de LLM só será escolhido depois da avaliação de LGPD, do contrato (retenção e não treinamento) e dos controles de proteção.

## Princípio central
**Agente interpreta; regra determinística decide; backend autorizado executa; contador supervisiona.** Nenhum agente tem acesso a certificado, token de produção, conector fiscal ou banco de todas as empresas. Cada agente recebe só o contexto da empresa da sessão, já resolvido pelo servidor.

## Os 6 agentes

| # | Agente | Usa LLM? | Entrada | Saída | Ferramentas permitidas | Nunca pode |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Atendimento** | Sim | mensagem do cliente autenticado | intenção classificada + resposta | `get_authenticated_client_context`, `get_request_status`, `create_human_review_task` | prometer prazo, dizer que nota foi emitida sem retorno oficial |
| 2 | **Cadastro** | Não (consulta) | `tenant_id` da sessão | dados autorizados da empresa e do tomador salvo | leitura via RLS do usuário | ler outra empresa; receber `tenant_id` do LLM |
| 3 | **Fiscal** | Sim, só extração | texto do pedido | JSON tipado (descrição, valor, tomador, competência) + campos faltantes | `extract_invoice_intent`, `request_missing_information`, `create_fiscal_draft` | escolher código de serviço, alíquota, retenção, NBS, cClassTrib |
| 4 | **Validação** | **Não** | rascunho | `PolicyResult` | `parseNfseDraft`, `evaluatePolicy` (já implementados) | ser substituído por LLM |
| 5 | **Supervisão** | Não (regras) + resumo por LLM opcional | exceções da política | tarefa na fila do contador | `create_human_review_task` | aprovar no lugar do contador |
| 6 | **Auditoria** | Não | eventos | trilha em `fiscal_request_events` e `audit_log`, alertas | escrita só pelo servidor | apagar ou editar eventos |

## Fluxo
```text
Cliente -> Atendimento (classifica) -> Cadastro (contexto da sessão)
        -> Fiscal (extrai JSON; o backend revalida tudo com o schema estrito)
        -> Validação (determinística) -> {pronto | revisão | bloqueado}
        -> Supervisão (exceção vai ao contador) ; Auditoria registra cada passo
Transmissão: NÃO é ferramenta de agente. Só o worker, após confirmação do cliente,
aprovação do contador e checagem de política/permissão.
```

## Controles contra prompt injection
- Mensagens, PDFs e anexos são **dados**, nunca instruções; ficam em campo separado do prompt de sistema.
- Ferramentas sem efeito fiscal; as poucas que gravam (rascunho, tarefa) passam pelo mesmo schema estrito e pela RLS do usuário.
- Toda saída do LLM é revalidada; flags como `verified` ou `requires_human_review` vindas do modelo são ignoradas.
- Limite de chamadas por empresa e por usuário; orçamento mensal com corte.

## Proteção de dados antes de qualquer provedor externo
1. RIPD e base legal definidos pela WJB.
2. Contrato com retenção zero ou mínima e sem uso para treinamento.
3. Minimização: CPF/CNPJ mascarado ou substituído por referência interna; o modelo recebe "tomador salvo #123", não o documento.
4. Desenvolvimento e homologação só com dados fictícios (como hoje).

## Avaliação (antes de ligar)
Suíte de casos fictícios: manicure MEI, cabeleireiro, cliente sem cadastro, CPF inválido, valor divergente, pedido de mercadoria, duplicidade, tentativa de injeção. Meta obrigatória: **zero transmissões indevidas e zero status fiscal inventado**.
