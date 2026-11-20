# 12 - Pendências e decisões

## Precisam de aprovação ou decisão da WJB
1. Aplicar a migration 0024 no banco de produção.
2. Publicar o código do F1 (o módulo continua desligado; o deploy é automático no push).
3. Quem é o **WJB_FISCAL_ADMIN** (aprova perfil fiscal e autorizações): criar papel novo ou usar `contador`?
4. Cofre de certificados (KMS/vault) e onde ficará; tem custo.
5. Plano pago do Supabase (atendimento 24h e o próprio banco não podem pausar).
6. Provedor de LLM, contrato de retenção/treinamento e análise LGPD antes de enviar dados reais.
7. Contador: matriz de enquadramento e limites por cliente.
8. Credenciamento/procuração da WJB no Emissor Nacional para homologação.

## Decisões técnicas tomadas
- Módulo isolado; nenhuma alteração em código existente neste incremento.
- Permissões próprias do WJB AI em vez de alterar `src/lib/permissions`.
- Prévia sem persistência enquanto a 0024 não for aprovada.
- Fila futura no Postgres + agendamento existente, sem Redis.
- Subagentes: os 14 papéis foram executados em sequência por um agente; definições em `.claude/agents/` para uso futuro.
