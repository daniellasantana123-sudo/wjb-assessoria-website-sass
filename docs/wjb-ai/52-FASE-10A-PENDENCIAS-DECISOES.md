# 52 - Fase 10A: pendências e decisões

## Dependem da WJB
| # | Decisão | Contexto |
| --- | --- | --- |
| 1 | Aprovar a **etapa A** (só dependências na produção) | a produção atual roda `next` 16.3.7, vulnerável (doc 51) |
| 2 | Aprovar o step-up também nas ações de equipe já em produção (convidar, mudar papel, suspender) | hoje só fiscal e preços exigem; ligar muda o uso de contas sem MFA |
| 3 | Tornar o MFA **obrigatório** para a equipe (super admin, contador) | sem MFA, as ações críticas ficam bloqueadas; com ele, a conta da CEO também precisa ativar |
| 4 | Aprovar o reforço no **banco** (exigir `aal2` nas funções de aprovação e nas políticas de preço) | fecha o desvio pelo PostgREST com senha vazada; mexe em funções de produção e em ~120 testes |
| 5 | Plano Supabase (Pro: backups diários e PITR) | pré-requisito de backup testado do doc 51 |
| 6 | Textos jurídicos (termos, privacidade da emissão, reembolso, representação fiscal) | inalterado |
| 7 | Colocar as chaves de **teste** da Stripe e rodar o Sandbox (`configurar-chaves.mjs`, `sandbox.sh`) | inalterado; sem `sk_live_` |
| 8 | Certificado e-CNPJ A1 novo e cofre (Fase 10B fiscal) | inalterado |
| 9 | Destino do 2º WhatsApp (oculto, não apagado) | inalterado |

## Dependem do suporte do Supabase ou da Hostinger
| # | Item |
| --- | --- |
| 10 | Encerramento e causa do incidente de 20/11 no `wjb-website-app` |
| 11 | Acesso de leitura ao banco de produção para conferir migrations, políticas e backups |
| 12 | Cabeçalho confiável do proxy da Hostinger para o IP do visitante (hoje o limite usa o primeiro `x-forwarded-for`, que pode ser forjado; o teto global segura o abuso) |

## Técnicas (sem decisão de negócio)
| # | Item | Prioridade |
| --- | --- | --- |
| 13 | O Supabase aceita o mesmo código TOTP duas vezes dentro da janela (achado do teste). Baixo risco; acompanhar se o provedor oferecer bloqueio de repetição | baixa |
| 14 | Testar a exclusão de empresa com trilha de certificado (`on delete set null` contra o gatilho de imutável) | média |
| 15 | Mensagens de erro do Postgres na tela da equipe (`wjb-ai-admin`) | baixa |
| 16 | Padronizar formatadores de data e moeda (5 de moeda, 4 ou mais de data) | baixa |
| 17 | Testes em aparelhos reais, Safari, Firefox e leitor de tela | antes do lançamento |
| 18 | Medir o desempenho (PageSpeed) depois da atualização do Next | antes do lançamento |
| 19 | URL pública de homologação (webhook da Stripe) e agendamento das rotinas | antes da Fase 10B |

## Sem mudança nesta fase
- NFS-e oficial: bloqueada (certificado, cofre, autorização).
- Pagamentos: só teste, live bloqueado em código e banco.
- IA: nada generativo (regras determinísticas).
- WhatsApp: só Click-to-Chat no número oficial.
- Omie/G-Click: nenhum arquivo alterado.

---

## Atualização da Fase 10A.1 (22/11/2026): aprovações necessárias, em ordem
| # | Aprovação | Situação |
| --- | --- | --- |
| A1 | **Emergência:** a WJB conferir o banco de produção no painel e cobrar o suporte do Supabase (doc 54: API sem tabelas, Auth com 0 usuários) | **urgente**; nada foi tocado |
| A2 | Deploy da **etapa A** (hotfix `hotfix/next-16.4.6-security`, `70d08787`) na `main` | pronto para revisão; independe do banco |
| A3 | Decidir a reconstrução, caso os dados não voltem (migrations 0001-0023, conta da CEO, reimportação do G-Click) | depende de A1 |
| A4 | Etapa B (0034 + formulários) | depende de A1 |
| A5 | MFA **obrigatório** para a equipe (super admin, contador) antes da 0035 em produção | pré-requisito da etapa D4 |
| A6 | Etapas C, D e E | dependem de A1, A2 e A5 |
| A7 | Etapa F (pagamentos e fiscal) | Sandbox, jurídico, certificado |

**Resolvido nesta fase (em homologação):** item 4 do quadro acima (reforço de `aal2` no banco), com a migration 0035 testada local e na API real.

**Técnicas novas:**
- A validade do certificado é comparada em fusos diferentes (data de Brasília x data UTC do certificado); revisar na Fase 10B.
- Os erros do Supabase vão inteiros para o log do servidor; avaliar reduzir para código e mensagem.
- O `vitest` do hotfix fica com 3 moderadas (só ferramenta de teste); atualizar junto com a etapa C.

---

## Atualização da Fase 10B (26/11/2026)
Detalhe nos documentos `FASE-10B-*`.

| # | Decisão ou ação | Quem | Situação |
| --- | --- | --- | --- |
| B1 | Revogar na AC o certificado exposto e pedir a reemissão (e-CNPJ da WJB, depois de 26/11) | titular / WJB | **urgente** |
| B2 | Conferir no painel o estado do banco de produção. Em 26/11 a API voltou a ver as tabelas (resposta `[]`, sem `PGRST205`); não se sabe se há dados | WJB / suporte | **urgente** |
| B3 | Autorizar o deploy da etapa A (hotfix 16.4.6, ainda a estável mais recente) | WJB | pronto |
| B4 | Contador confirmar `indDest=0` (tomador = destinatário) para o leiaute da NT 009 release 2 | contador WJB | pendente |
| B5 | Escolha e contratação do cofre (depende da confirmação do algoritmo de assinatura) | WJB | sem custo novo nesta fase |
| B6 | Chaves de teste da Stripe e execução do Sandbox | WJB | inalterado |

**Resolvido nesta fase:** a validade do certificado passou a ser comparada por instante (pendência técnica da 10A.1).
