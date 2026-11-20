# 04 - Plano de implementação

| Ticket | Fase | Prioridade | Depende de | Esforço | Status |
| --- | --- | --- | --- | --- | --- |
| T1 Interruptores em runtime + permissões próprias | F1 | P0 | - | P | **Feito** |
| T2 Máquina de estados + política + idempotência + conector simulado | F1 | P0 | T1 | M | **Feito** |
| T3 Rota de prévia `/api/wjb-ai/fiscal/drafts/preview` | F1 | P0 | T2 | P | **Feito** |
| T4 Migration 0024 (perfil, autorização, pedidos, eventos, tentativas) | F1 | P0 | aprovação | M | **Escrita, não aplicada** |
| T5 Persistência do pedido + eventos + tipos em `database.ts` | F1b | P0 | T4 aplicada | M | Pendente |
| T6 Tela "Solicitar NFS-e" e prévia no Portal | F1b | P1 | T5 | M | Pendente |
| T7 Cadastro de perfil fiscal e autorização no Admin (contador) | F3 | P0 | T5, WJB_FISCAL_ADMIN | M | Pendente |
| T8 Fila de revisão no Admin | F3 | P0 | T5 | M | Pendente |
| T9 Fila de envio (tabela + cron) com MockFiscalProvider e conciliação | F3 | P0 | T5 | G | Pendente |
| T10 Atendimento com LLM (extração JSON, ferramentas sem efeito fiscal) | F2 | P1 | contrato LLM + LGPD | G | Bloqueado |
| T11 Conector NFS-e Nacional em homologação | F4 | P1 | cofre, docs oficiais, credenciamento | G | Bloqueado |
| T12 WhatsApp oficial (webhook, opt-in) | F5 | P2 | conta WABA | G | Bloqueado |
