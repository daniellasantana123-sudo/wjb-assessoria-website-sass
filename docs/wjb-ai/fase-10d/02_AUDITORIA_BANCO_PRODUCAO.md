# Fase 10D - Auditoria do banco de produção (não destrutiva)

**Data:** 26/11/2026. **Projeto:** `wjb-website-app` (ref começa com `hlyuku`).

## 1. Por que a auditoria é feita pela WJB, e não por mim
A orientação foi usar, de preferência, um acesso de leitura com **privilégio mínimo**. Esse acesso **não existe** hoje:

| Credencial disponível | Por que não serve |
| --- | --- |
| Chave pública (anon) | a RLS esconde todas as linhas; só prova que as tabelas existem |
| Chave de serviço (service role) | ignora a RLS e pode escrever em tudo: é o **oposto** de privilégio mínimo |
| Senha do banco (Postgres) | não está comigo, e também é acesso total |

Criar um usuário de leitura no banco de produção seria **alterar a produção**, o que não está autorizado. Por isso preparei um script que o responsável da WJB roda no painel. Ele é seguro por construção.

## 2. O que já foi verificado daqui (26/11, 21:48), só com a chave pública e no próprio servidor
| Verificação | Resultado |
| --- | --- |
| Auth (`/auth/v1/health`) | 200: o projeto está ativo, não pausado |
| `profiles`, `tenants`, `obligations`, `leads`, `documents` pela API | `[]` sem erro: as tabelas **existem**; a RLS esconde as linhas |
| Conclusão | igual à de 26/11 de manhã: **não dá para saber se há dados** sem uma credencial privilegiada |

A chave pública foi lida e usada só dentro do servidor. Só os códigos de resposta saíram de lá.

## 3. O script
`scripts/wjb-ai/producao/auditoria-somente-leitura.sql`

**Garantias:**
- a primeira linha põe a sessão em **somente leitura** (`default_transaction_read_only = on`). Testado: um `UPDATE` nessa sessão é recusado pelo Postgres (`cannot execute UPDATE in a read-only transaction`);
- não cria, altera nem apaga nada: só `SELECT`;
- devolve **uma** tabela (`secao | item | valor`) com contagens e verdadeiro/falso. Nenhum nome, e-mail, CPF, CNPJ ou conteúdo de documento. Só aparecem nomes de tabelas, políticas e buckets;
- **testado na homologação** (Supabase real, mesmo esquema e mais as tabelas novas): 101 linhas, sem erro.

**Como rodar (responsável da WJB):**
1. Painel do Supabase → projeto de **produção** → SQL Editor → New query.
2. Colar o arquivo inteiro → Run.
3. Exportar o resultado (CSV) ou copiar a tabela e me mandar. Não há dado pessoal nela.

Se der erro de tabela inexistente, isso já é um achado importante: o esquema está incompleto. Nesse caso, mande só a mensagem de erro.

## 4. O que cada seção responde
| Seção | Itens | Como ler |
| --- | --- | --- |
| `identificacao` | banco, versão, sessão somente leitura | `sessao_somente_leitura` precisa ser `on` |
| `auth` | usuários, confirmados, login em 30 dias, banidos, com MFA, primeiro e último cadastro | **0 usuários** = o Auth foi perdido ou recriado |
| `linhas` | contagem **exata** de cada tabela | referência de 24/09: 1 conta, 2 empresas, 6 obrigações, 0 leads |
| `equipe` | equipe, super admin, contador, atendimento, **super admin sem MFA**, **equipe com e-mail de teste** | super admin sem MFA ou conta de teste = risco imediato |
| `integridade` | perfis sem usuário, usuários sem perfil, e-mails e CNPJs duplicados, empresas sem membro, vínculos órfãos, obrigações, documentos e chamados sem empresa, **documentos sem arquivo no Storage**, notificações sem destinatário, vínculos G-Click órfãos | tudo deveria ser 0, exceto `empresas_sem_cnpj` (que pode ser legítimo) |
| `schema` | tabelas, views, funções, funções SECURITY DEFINER (e as **sem `search_path`**), gatilhos, restrições por tipo, índices (e **inválidos**), extensões | esperado em produção: 13 tabelas (até a 0023); `security_definer_sem_search_path` = nenhuma; `indices_invalidos` = 0 |
| `rls` | tabelas **sem RLS**, políticas, tabelas com RLS sem política, políticas `true` para anon ou public, tabelas com escrita concedida a anon, guarda da 0022, funções de acesso | `tabelas_sem_rls` e `politicas_using_true_para_anon_ou_public` precisam ser **nenhuma**. "Escrita concedida a anon" é o padrão do Supabase: quem decide é a RLS. "RLS sem política" = ninguém acessa pela API (correto para tabelas só do servidor) |
| `migrations` | tabela de histórico, marcadores da 0016, 0017, 0020, 0022 e 0023, e tabelas que **não deveriam existir** em produção | marcadores `true` e `tabelas_wjb_ai_ou_comercial_NAO_deveriam_existir` = **0** |
| `storage` | buckets (público ou privado), arquivos por bucket, tamanho, políticas | `documents` precisa ser **privado** |

## 5. O que o script não alcança (conferir no painel)
| Item | Onde |
| --- | --- |
| Backups automáticos, histórico e retenção | Database → Backups |
| Point-in-Time Recovery | Database → Backups → PITR (depende do plano) |
| Plano e cobrança | Billing |
| Papéis internos sem senha (incidente de 19-20/11) | suporte do Supabase |
| Isolamento entre empresas **na prática** | só testando com dois usuários de empresas diferentes. Sem dados reais em risco, isso deve ser feito num **projeto restaurado** (doc 04 da Fase 10C), não na produção |
| Separação entre produção e homologação | conferir a URL de cada projeto: produção `hlyuku…`, homologação `uisoyo…`. A aplicação de produção aponta para `hlyuku…` (conferido no servidor). As credenciais da homologação ficam só neste computador (`.env.homolog.local`), e os scripts de homologação recusam a URL da produção |

## 6. Depois do resultado
| Resultado | Próximo passo (doc 04 da Fase 10C) |
| --- | --- |
| Contagens batem com a referência, RLS ok | caminho A: sem recuperação; seguir para a preparação da 10C |
| Tabelas vazias e existe backup | caminho B: restaurar **num projeto novo** e conferir |
| Tabelas vazias e não há backup | caminho C: reconstrução controlada |
| Tabela sem RLS, super admin sem MFA, conta de teste com poder | caminho D: tratar como incidente primeiro |

Nenhum desses caminhos é executado sem a sua autorização específica.

## 7. Resultado desta auditoria
**Pendente:** aguarda a WJB rodar o script. Este documento será atualizado com as contagens recebidas.
