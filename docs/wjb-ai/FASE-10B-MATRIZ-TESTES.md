# Fase 10B - Matriz de testes

**Data:** 26/11/2026, na branch `wjb-ai/10b-continuidade`.

Só entra aqui o que foi **executado**. Cada resultado indica onde rodou.

## 1. Resultados
| Bateria | Onde | Resultado |
| --- | --- | --- |
| Lint e TypeScript | local | sem erros |
| Unitários e integração (Vitest) | local | **655/655** (+44 em relação à 10A.1; 42 deles em `wjb-ai-fase10b.test.ts`) |
| Banco local: RLS, isolamento, permissões, aal2, backup e restauração, **rollback 0035 a 0024** (`run.sh`) | Postgres 17 local | **139 OK**, sem falhas |
| API real da homologação: fiscal (`02`), comercial (`06`), pagamentos (`07`), MFA no banco (`09`) | Supabase `wjb-ai-homologacao` | todos **sem falhas** |
| Conexão direta ao Postgres da homologação (`00`) | homologação | OK, transação somente leitura |
| Telas com login real e MFA (`staging.sh`, 1ª execução) | build local + homologação | **46/46**, inclui os 2 novos da Fase 10B |
| Pagamentos simulados (2ª execução do staging) | build local + homologação | **9/9** |
| Webhook em modo `stripe_test` com segredos só de formato (3ª execução) | build local | **2/2** |
| Regressão geral (site, Portal, Admin, assistente) | build de produção local | **96/96** |
| Responsividade e acessibilidade (axe), de 320 a 1920 px | build local + homologação | **482 medições**, 0 estouros, 0 violações |
| `npm audit` | local | **0** vulnerabilidades |

## 2. Cenários pedidos pela Fase 10B
| Cenário | Coberto por |
| --- | --- |
| Isolamento entre duas empresas fictícias, RLS e chamadas diretas | `run.sh` (T-testes), `02`, `06`, `07`, `09`, staging (empresa B não abre o pedido nem o checkout da A) |
| Assinatura XML só com certificado fictício, validada por ferramenta independente | `wjb-ai-xmldsig.test.ts` (C14N igual ao `xmllint`, assinatura conferida pelo `openssl`) |
| Nenhum caminho aceita o certificado exposto ou um upload de certificado | política (`CERT_ISSUED_BEFORE_INCIDENT`, `WJB_CERT_NOT_ECNPJ`, `CERT_COMPROMISED`) e varredura de `app/`, `actions/` e `components/` |
| Trilha sem CPF/CNPJ completo, senha, chave ou token | `useCertificate` e portão (procura os documentos fictícios no registro); auditoria só com códigos |
| Recusa sem perfil, aprovação, credencial, autorização ou interruptor | portão (cada condição isolada), `useCertificate` (autorização revogada, cofre trocado), política (sem cadeia ou revogação) |
| Duplicidade, concorrência, timeouts e conciliação | dois envios simultâneos com a mesma DPS (E0014 conciliado); timeout seguido de conciliação sem reenvio; carga da Fase 7 |
| DPS conforme o XSD oficial vigente | `wjb-ai-dps-xsd.test.ts` nos 3 pacotes (produção, release 1, **release 2**) |
| Contrato da API sem HTTP para o governo | cliente falso: autorizada, rejeitada, indeterminada (5xx, 409, 429, código fora do padrão, chave inválida), `HEAD`/`GET`, host, porta e credencial |
| Rótulo "SIMULAÇÃO - SEM VALOR FISCAL" | staging: 3 telas do Admin, Portal e API de prévia (`fiscalValue: false`) |
| Falhas de rede e rollback de migrations | indeterminado no transporte; `run.sh` (rollback) |
| Área do Cliente, Admin, Resend e Omie/G-Click preservados | regressão 96/96; nenhum arquivo de G-Click ou de e-mail alterado |

## 3. Problemas achados durante os testes
| Achado | Tipo | Tratamento |
| --- | --- | --- |
| A DPS era recusada pelo XSD do release 2 (`indDest`) | **defeito real** | corrigido |
| 4 itens médios e 9 baixos na revisão de segurança independente | defesa em profundidade | 12 corrigidos (seção 6 do relatório) |
| Teste "pede correção" estourou os 30 s (dois logins com MFA + revisão) | tempo do teste, sem erro no fluxo | limite de 60 s nesse teste |
| Série de pagamentos estourou os limites (chamadas ao Supabase remoto de 200 a 800 ms em 26/11) | tempo do teste; nenhum arquivo de pagamento mudou nesta fase | limites de 20 s por verificação e 120 s por teste nessa série. Com eles, 9/9 |
| Asserção "nenhum número de 11+ dígitos" falhava por acaso com a impressão digital em hexadecimal | teste instável | troca pela busca dos documentos fictícios; 3 execuções seguidas sem falha |
| Seletor "Bloqueada" casava também com "continua bloqueada" | teste novo | texto exato |
| **Correção de um relato intermediário:** depois da 1ª falha de pagamentos, eu disse que os outros 8 testes tinham passado. Eles foram **pulados**, porque a série é serial | registro | a execução final passou os 9 |

## 4. Não verificado
- Aparelhos reais (iPhone, Android), Safari, Firefox e leitor de tela. A auditoria é em Chromium emulado.
- Teclado virtual do celular sobre os formulários.
- Qualquer chamada à Stripe real (sem chaves de teste) ou ao governo (não autorizado).
- Desempenho (PageSpeed) depois da atualização do Next.js na produção.
