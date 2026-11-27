# Fase 10H - Auditoria do banco de produção

**Situação:** **aguardando a WJB.** Nada foi executado no banco de produção; a chave de serviço da produção não foi usada; nenhuma migration, alteração ou restauração.

## 1. Roteiro operacional (para o responsável da WJB)
Passo a passo completo: doc 02 da Fase 10G, seção 1. Em resumo:
1. Supabase → projeto **wjb-website-app** → **SQL Editor** → colar `scripts/wjb-ai/producao/auditoria-somente-leitura.sql` → **Run**.
2. Conferir na seção `identificacao` que `sessao_somente_leitura` = `on`. Se não for, parar.
3. **Export → CSV** e enviar o arquivo por canal privado.
4. **Database → Backups** e **Settings → Billing**: só olhar e anotar as datas dos backups, se há PITR e o plano.
5. Enviar o chamado (texto revisado no doc 02 da 10G, seção 2), que pede **primeiro a preservação** dos backups anteriores a 12/10/2026 20:00 UTC.

## 2. Cobertura do script (o que ele verifica)
| Pedido do PO | Itens do script |
| --- | --- |
| Usuários e autenticação | total, confirmados, login em 30 dias, banidos, MFA, primeira e última criação, equipe por papel, super admin sem MFA, e-mails de teste |
| Empresas e clientes | empresas, vínculos, empresas sem membro, vínculos com o G-Click |
| Obrigações | contagem, obrigações sem empresa |
| Documentos | contagem, sem empresa, **sem arquivo no Storage** |
| Quantidade de registros | por tabela |
| Integridade referencial | 10 verificações de órfãos |
| Tabelas e relacionamentos | tabelas, restrições (PK, FK, unique, check), índices e índices inválidos |
| Migrations | histórico e marcos 0016, 0017, 0020, 0022, 0023 |
| RLS | tabelas sem RLS, com RLS e sem política, políticas abertas para `anon`, guarda 0022, funções de acesso |
| Storage | buckets, arquivos por bucket, tamanho, políticas |
| Backups e PITR | **fora do SQL**: painel (passo 4) e chamado |

## 3. Critérios de validação
`node scripts/wjb-ai/producao/analisar-auditoria.mjs <arquivo.csv>` classifica cada item em OK, ATENÇÃO ou CRÍTICO e indica o caminho:
- **A:** dados íntegros;
- **B ou C:** recuperar de backup **em projeto separado**;
- **D:** recadastrar.

Referência em 24/09: 1 conta, 2 empresas, 6 obrigações. Testado com o resultado real da homologação.

## 4. Recuperação (só com autorização)
Sempre em **projeto novo**, nunca sobre `hlyukumgyzswfndlzwcf`. Comparar com a auditoria antes de copiar qualquer coisa, e copiar de volta só com autorização expressa, tabela por tabela, com backup do estado atual antes. Procedimento completo: doc 01 da Fase 10E, seções 4 e 5.

## 5. Investigação de 12 e 13/10
Preservada: linha do tempo no doc 02 da 10F (rotina com sucesso até 12/10 20:00 UTC; falha diária a partir de 13/10 17:49; `PGRST205` de 10/11 a 25/11; tabelas visíveis de novo em 26/11). Nada mudou nesta fase. Os lembretes rodaram com sucesso em 26/11, o que **não prova** que os dados voltaram.
