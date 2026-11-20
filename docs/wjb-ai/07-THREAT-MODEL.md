# 07 - Threat model (versão inicial)

| Ameaça | Vetor | Controle atual | Lacuna |
| --- | --- | --- | --- |
| IDOR/BOLA entre empresas | `tenant_id` no corpo, URL ou webhook | empresa da sessão; `.strict()`; RLS na 0024 | testes de RLS reais após aplicar a 0024 |
| Account takeover via WhatsApp | número de telefone como identidade | WhatsApp de entrada não existe | vínculo prévio + step-up (F5) |
| Exfiltração de certificado | banco, logs, LLM | banco guarda só referência | cofre inexistente |
| Prompt injection | mensagem, PDF anexado | LLM ainda não existe; ferramentas planejadas sem efeito fiscal | suíte adversarial (F2) |
| Alucinação fiscal | LLM decide código/alíquota | parametrização só do perfil aprovado | - |
| Duplicidade | retry, concorrência, timeout | idempotência + conciliação + unique | teste de concorrência real no banco (F3) |
| Forjar resultado oficial | update direto pela API do banco | RLS impede staff nos estados de transmissão | - |
| Webhook falso / replay | rota pública | nenhuma rota de webhook criada | assinatura + replay (F5) |
| Custo de LLM | requisições repetidas | rate limit em memória | limitador persistente + orçamento |
| PII em logs/analytics | corpo do pedido | rota não loga; `dataLayer` com lista fechada | revisar observabilidade (F3) |
