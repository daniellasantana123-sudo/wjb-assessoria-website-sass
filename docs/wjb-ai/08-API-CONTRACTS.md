# 08 - Contratos de API

## POST /api/wjb-ai/fiscal/drafts/preview (F1)

Prévia de NFS-e. **Não grava, não transmite, não chama IA.** Desligada por padrão (`WJB_AI_ENABLED`).

Entrada (campos extras são recusados, inclusive `tenant_id`):
```json
{
  "serviceDescription": "Serviços de cabeleireiro",
  "grossAmount": "250.00",
  "competence": "2026-11",
  "taker": { "document": "000.000.000-00", "name": "Nome do tomador", "email": "opcional" },
  "sourceReference": "opcional, diferencia pedidos iguais de propósito"
}
```

Respostas:
| Status | Quando |
| --- | --- |
| 404 | módulo desligado |
| 401 | sem sessão |
| 403 | equipe WJB (usa a fila de revisão, F3), sem empresa ativa ou sem permissão |
| 422 | rascunho inválido, com `missingOrInvalid[{field, message}]` |
| 429 | mais de 5 pedidos por minuto do mesmo usuário |
| 200 | `{ ok, simulated: true, transmitted: false, preview{... documentMasked}, policy{decision, reasons[]}, idempotencyKey }` |

`policy.decision`: `BLOCKED`, `HUMAN_REVIEW` ou `READY_FOR_CONFIRMATION`. Enquanto a 0024 não estiver aplicada não existe perfil fiscal nem autorização, então a resposta é sempre `HUMAN_REVIEW`.

## Área do Cliente (F2, desligada por padrão)
| Rota / ação | O que faz |
| --- | --- |
| `/portal/nfse` | histórico das solicitações da empresa ativa, com status |
| `/portal/nfse/nova` | formulário + prévia + "Confirmar e enviar solicitação" |
| `/portal/nfse/[id]` | dados, motivos da revisão e andamento (eventos); pedido de outra empresa = 404 |
| `previewNfseAction` | prévia sem gravar (mesma lógica da rota) |
| `submitNfseAction` | grava em `fiscal_requests`, aplica política, registra eventos e `audit_log`; repetido = devolve o existente |

Todas as telas retornam 404 com o módulo desligado e para a equipe WJB (que usará a fila de revisão).

## Funções no banco (0024)
`grant_fiscal_profile_approver(profile, tenant|null, motivo)` e `revoke_fiscal_profile_approver(grant, motivo)` - só super_admin. `approve_fiscal_profile(perfil, justificativa)` - só contador com concessão ativa para a empresa. `can_approve_fiscal_profile(tenant)`.

## Próximos (não implementados)
`POST /api/wjb-ai/fiscal/requests`, `GET .../requests`, `GET .../requests/:id`, `POST .../confirm`, `POST .../approve` (contador), `GET .../status`, `GET /api/wjb-ai/admin/review-queue`. **Não haverá rota de "submit" chamável pelo cliente nem pelo LLM**: o envio é do worker, após aprovação.
