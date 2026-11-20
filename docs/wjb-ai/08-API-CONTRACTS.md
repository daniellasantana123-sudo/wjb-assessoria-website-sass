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

## Próximos (não implementados)
`POST /api/wjb-ai/fiscal/requests`, `GET .../requests`, `GET .../requests/:id`, `POST .../confirm`, `POST .../approve` (contador), `GET .../status`, `GET /api/wjb-ai/admin/review-queue`. **Não haverá rota de "submit" chamável pelo cliente nem pelo LLM**: o envio é do worker, após aprovação.
