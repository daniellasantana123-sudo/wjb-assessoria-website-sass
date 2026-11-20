# 02 - PRD e escopo

**Objetivo:** permitir que o cliente peça a emissão de NFS-e pela Área do Cliente e que a WJB a conduza com segurança, rastreabilidade e revisão humana nas exceções.

## MVP
Atendimento digital, perfil fiscal aprovado pelo contador, autorização de emissão registrada, rascunho, prévia, validação, fila de revisão, conector **simulado** e, depois de aprovado, conector de **homologação**. Histórico e auditoria.

## Fora do MVP
NF-e (55) e NFC-e (65); cancelamento/substituição; autoemissão; WhatsApp real; produção.

## Papéis (mapeados ao banco atual)
| Documento mestre | No sistema |
| --- | --- |
| CLIENT_OWNER / CLIENT_OPERATOR | `tenant_members.role` = `owner` / `member` |
| WJB_CONTADOR / WJB_ATENDENTE / WJB_SUPER_ADMIN | `staff_role` = `contador` / `atendimento` / `super_admin` |
| WJB_FISCAL_ADMIN | **não existe** - pendência |

## Critérios de aceite do F1 (atendidos)
- Módulo desligado por padrão (rota 404).
- Duas empresas sintéticas não acessam dados uma da outra.
- Rascunho validado sem gravação, sem transmissão e sem IA.
- Nenhuma regressão (suíte existente inteira passando).

## KPIs futuros
Pedidos por empresa, taxa de revisão humana, rejeições, tentativas indeterminadas, tempo até a nota, custo de LLM por pedido.
