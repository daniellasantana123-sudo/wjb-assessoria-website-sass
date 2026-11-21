# 51 - Fase 10A: plano de publicação controlada (NÃO executado)

Nenhum passo deste documento foi executado. Cada etapa depende de **aprovação independente**.

## 1. Estado atual
| Item | Produção (`main` `a7d15d22`, `wjb-website-app`) | Homologação (`wjb-ai-homologacao`) |
| --- | --- | --- |
| Código | Fase 1 (módulo fiscal desligado) | `wjb-ai/10a-hardening` (Fases 2-10A) |
| Migrations | 0001-0023 **presumidas** (histórico real não verificado) | 0001-0034 |
| Dependências | `next` 16.3.7 (vulnerável) | `next` 16.4.6 |
| Banco | incidente aberto em 20/11. Auth responde; saúde e dados **não verificados** | estável |

## 2. Pré-requisitos (bloqueiam qualquer etapa)
1. Confirmar com o suporte do Supabase o fim do incidente e a causa, sem presumir.
2. Acesso de leitura autorizado ao banco de produção para:
   - listar as migrations aplicadas;
   - conferir coluna a coluna o que 0016 e 0018 criam (`profiles.status`, `tenants.status`);
   - comparar as políticas RLS.
3. **Backup completo testado** (restaurado num projeto de teste) antes de cada lote. Avaliar o plano Pro, por causa dos backups diários e do PITR.
4. Aprovação da WJB por escrito para cada etapa.

## 3. Inventário das migrations pendentes (11 arquivos: 0024-0034)
Análise do agente de dados, conferida no SQL:
- **Nenhuma** altera, recria ou apaga objeto existente em 0001-0023 (só leem `tenants`, `profiles`, `is_staff`, `is_super_admin` e `my_tenant_ids`; só gravam em `audit_log`).
- O código atual da `main` segue funcionando depois delas (só expansão).
- Risco de lock desprezível: as tabelas alteradas são criadas no próprio lote e estão vazias.
- Só 0025, 0031 e 0034 (com `if not exists` nos índices) aguentam ser rodadas de novo.

| Lote | Migrations | Observação |
| --- | --- | --- |
| 1 | 0024-0029 numa transação | **nunca 0024 sem 0027**: a 0024 deixa a equipe apagar autorizações até a 0027 corrigir |
| 2 | 0030 + 0031 juntas | nunca 0030 sozinha (`has_entitlement` ficaria aberta a usuário logado) |
| 3 | 0032 | aprovação versionada de preços |
| 4 | 0033 | só quando os pagamentos de teste forem aprovados |
| 5 | 0034 | limite compartilhado e índices. **Pode ir antes**, junto com a correção das dependências, porque não depende das outras |

Execução: cada arquivo dentro de `begin; ... commit;`. Registrar cada aplicação: pelo SQL Editor não há registro automático.

## 4. Rollback
- Ordem reversa estrita. O rollback da 0024 falha se as tabelas da 0030 existirem.
- **Antes de gravações reais**, os scripts `*_rollback_*.sql` desfazem tudo; testados localmente: o banco volta ao estado anterior à 0024.
- **Depois de gravações reais**, o rollback **perde dados de forma definitiva**:
  - numeração da DPS (risco de colisão E0014 se reaplicar);
  - trilha de certificado;
  - aprovação de preços;
  - status de assinatura.

  O caminho seguro passa a ser **restaurar o backup**.

## 5. Publicação em etapas
| Etapa | O quê | Verificação | Volta atrás |
| --- | --- | --- | --- |
| A | **Só a correção de dependências** (Next 16.4.6, zod 4.6.7) + `poweredByHeader` na `main` atual | build; regressão 96/96; site, Portal, Admin e G-Click conferidos à mão | reverter o commit (redeploy automático da Hostinger) |
| B | Lote 5 (0034) na produção + código do limite compartilhado | formulários enviando; contador no banco | rollback 0034 (sem perda: só contadores) |
| C | Código das Fases 2-10A na `main` com **todos os interruptores desligados** (`WJB_AI_ENABLED`, `WJB_COMMERCIAL_ENABLED`, `WJB_PAYMENTS_ENABLED` ausentes) | regressão; rotas novas dando 404; MFA e step-up funcionando para a equipe | reverter o commit |
| D | Lotes 1-3 das migrations (tudo desligado) | `run.sh`-like contra cópia; RLS 100%; telas atuais intactas | rollback **antes** de qualquer uso; depois, só backup |
| E | Ligar interruptores aprovados, um por vez (ex.: `WJB_AI_ENABLED` para a equipe interna) | monitoramento e auditoria | desligar o interruptor (sem redeploy) |
| F | Lote 4 (0033) e pagamentos em teste na produção | só depois do Sandbox aprovado e do jurídico | interruptor desligado |

A etapa **A** é a mais urgente e independe da WJB AI: a produção atual roda o `next` vulnerável.

## 6. Decisões de produção que mudam comportamento (aprovar antes da etapa C)
- MFA exigido nas rotas de API (`getVerifiedSession`): equipe e clientes com MFA que fiquem em aal1 deixam de acessar a API, como já acontecia nas páginas.
- Limites de tamanho nos formulários públicos (mensagem de erro nova em campo exagerado).
- `x-powered-by` removido.
