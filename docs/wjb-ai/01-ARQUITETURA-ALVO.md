# 01 - Arquitetura alvo (adaptada à stack verificada)

Mantém Next.js + Supabase. Nenhum framework novo.

```text
Canais: Área do Cliente (/portal) | WhatsApp oficial (F5, após aprovação)
                       |
   Route Handlers /api/wjb-ai/*  -> getSession() + getActiveTenant()  (tenant SÓ da sessão)
                       |
   Atendimento (F2): LLM só extrai intenção + JSON; ferramentas sem efeito fiscal
                       |
   Policy Engine determinístico (src/lib/wjb-ai/fiscal/policy.ts)
        BLOCKED | HUMAN_REVIEW | READY_FOR_CONFIRMATION   (sem autoaprovação até F7)
                       |
   Confirmação do cliente -> aprovação do contador -> fila (tabela Postgres + cron)
                       |
   FiscalProvider: MockFiscalProvider (F1)  |  NationalNFSeProvider (F4, homologação)
                       |
   fiscal_issuance_attempts / fiscal_request_events (append-only, service role)
```

## Decisões

1. **LLM nunca transmite.** Só o backend chama `FiscalProvider`, depois de política, permissão e aprovação, com snapshot imutável.
2. **Empresa sempre da sessão.** O schema do rascunho é `.strict()` e recusa `tenant_id` no corpo.
3. **Idempotência no servidor** (`sha256` do snapshot + empresa) e no banco (`unique (tenant_id, idempotency_key)`; um único `AUTORIZADA` por pedido).
4. **Timeout não é rejeição:** `ENVIANDO -> RESULTADO_INDETERMINADO -> CONCILIACAO_OFICIAL`, consulta de status antes de reenviar.
5. **Fila sem infraestrutura nova:** tabela de pedidos no Postgres + agendamento existente (GitHub Actions) ou worker dedicado quando o volume exigir. Redis/serviço pago só com análise de custo aprovada.
6. **Interruptores lidos em runtime:** `WJB_AI_ENABLED`, `WJB_AI_FISCAL_MODE` (`mock` padrão), `FEATURE_FISCAL_PRODUCTION_ENABLED` (sem efeito sozinho).
7. **Kill switch** `STOP ALL ISSUANCE`: `WJB_AI_ENABLED=false` derruba as rotas; o worker da F3 também lerá o interruptor antes de cada envio.
