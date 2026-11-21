# 38 - Fase 8: migrations, RLS e regras de cobrança no banco

Aplicadas **só** na homologação (`wjb-ai-homologacao`), com backup antes e registro sha256. A produção (`wjb-website-app`) não foi acessada.

## 1. Migrations
| Migration | Cria | Rollback |
| --- | --- | --- |
| `0030_wjb_commercial_plans` | 7 tabelas `commercial_*`, 3 gatilhos, a função `has_entitlement` e a RLS | `scripts/wjb-ai/homologacao/13_rollback_0030.sql` |
| `0031_wjb_commercial_entitlement_grant` | retira de `authenticated` o direito de executar `has_entitlement` (veja a seção 4) | `15_rollback_0031.sql` |

As duas só acrescentam: nenhuma tabela ou coluna existente muda. O `run.sh` confirma isso comparando o esquema antes e depois. Ordem: 0024 → … → 0029 → 0030 → 0031. O rollback vai na ordem inversa e foi testado de volta até o estado anterior à 0024.

## 2. Tabelas
| Tabela | Conteúdo | Quem lê | Quem grava |
| --- | --- | --- | --- |
| `commercial_plans` | catálogo (`draft`/`archived`, versão) | equipe | super admin (não apaga) |
| `commercial_plan_changes` | histórico de preço | equipe | gatilho |
| `commercial_settings` | desconto do combo e premissas de custo | equipe | super admin |
| `commercial_accounts` | relação da empresa (contabilidade ou somente emissão) | equipe e membros da empresa | servidor |
| `commercial_subscriptions` | assinatura (só `simulado`), com cópia do preço no momento da contratação | equipe e membros | servidor |
| `commercial_acceptances` | aceites versionados (só acrescenta) | equipe e membros | servidor |
| `commercial_usage_ledger` | consumo por pedido (só acrescenta) | equipe e membros | servidor |

O cliente **não lê o catálogo direto** (T81): a tela recebe os planos pelo servidor. Nenhuma tabela de dados da empresa tem política de escrita para usuário logado (T82), então toda escrita passa pelas Server Actions, que conferem o papel.

## 3. Regras garantidas pelo banco (não pela tela)
- Só existe assinatura simulada (T83) e só uma assinatura aberta por empresa (T84).
- Consumo simulado nunca é faturável (T86), o mesmo pedido não consome duas vezes (T87) e o registro de consumo não se altera nem se apaga (T88). A única exceção é a cascata ao apagar a empresa.
- O direito de uso (`has_entitlement`) é calculado no banco: emissão = assinatura `ativa_simulada` de um plano de emissão; contabilidade = relação `contabilidade`. Assinatura suspensa perde o direito na hora (T89).
- Isolamento: a empresa B não vê a assinatura nem o consumo da A (T90); a A vê a própria (T91).

## 4. Achado corrigido nesta fase (0031)
A 0030 liberava `has_entitlement` para qualquer usuário logado. Como a função ignora a RLS (SECURITY DEFINER) e recebe a empresa por parâmetro, quem soubesse o id de outra empresa descobriria se ela tem plano. A aplicação só chama a função pelo servidor (service role), então o acesso foi retirado:
- local, T92: usuário logado é recusado com o código 42501;
- homologação real: cliente logado recusado (42501), servidor responde normalmente.

## 5. Falha corrigida durante a implementação
O gatilho de histórico rodava **antes** de o plano existir e violava a chave estrangeira (23503). Isso impedia até o super admin de criar plano, e o T77 passava pelo motivo errado. Foi separado em dois gatilhos: versão (antes) e histórico (depois).

## 6. Validação
- `bash scripts/wjb-ai/homologacao/run.sh`: Postgres 17 local; aplica de 0001 a 0031; roda a bateria completa (até T92); faz backup e restauração; testa o rollback.
- `node scripts/wjb-ai/homologacao-supabase/01-migrations.mjs`: aplica o que falta na homologação real, com backup e sha256.
