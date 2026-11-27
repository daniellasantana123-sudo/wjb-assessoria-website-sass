# Fase 10C - Matriz de testes

**Data:** 26/11/2026, branch `feature/wjb-fase-10c`. Só entra aqui o que foi **executado**, com o lugar onde rodou. Os números da seção 1 são **finais**: refeitos depois das correções da revisão de segurança.

## 1. Executados
| Bateria | Onde | Resultado |
| --- | --- | --- |
| Lint e TypeScript | local | sem erros |
| Unitários e integração (Vitest) | local | **691/691** (+36 em relação à 10B; 36 em `wjb-ai-fase10c.test.ts`) |
| Banco local (Postgres 17): RLS, isolamento, permissões, MFA no banco, concorrência, backup e restauração, **rollback 0037 → 0024** (`run.sh`) | local | **188 OK**, sem falhas (+49: 0036 e 0037) |
| API real, ciclo de vida do certificado (`10-certificados-ciclo-de-vida.mjs`) | Supabase `wjb-ai-homologacao` | **21/21**, com limpeza |
| API real, fiscal (`02`), comercial (`06`), pagamentos (`07`), MFA no banco (`09`) | homologação | **56 + 14 + 12 + 11**, sem falhas |
| Telas com login real e MFA (`staging.sh`) | build local + homologação | **48/48** (inclui 2 novos da Fase 10C) |
| Pagamentos simulados / webhook `stripe_test` com segredos de formato | build local + homologação | **9/9** e **2/2** |
| Responsividade e acessibilidade (axe), de 320 a 1920 px, incluindo `/admin/nfse/certificados` | build local + homologação, Chromium | **497 medições**, 0 estouro, 0 violação |
| Regressão geral (site, Portal, Admin, assistente), Chrome desktop + celular emulado | build de produção local | **96/96** |
| Regressão em Firefox, WebKit (desktop) e iPhone emulado | — | **não executada**: o Playwright 1.62 não suporta Firefox nem WebKit no macOS 13 desta máquina (a instalação falhou). A configuração `playwright.crossbrowser.config.ts` está pronta para Linux (CI) ou macOS mais novo |
| Hotfix do Next.js, do zero (`npm ci`, lint, TypeScript, Vitest, build) | worktree separado | **373/373**, build "Compiled successfully" |
| Hotfix, regressão de telas (site, Portal, Admin) | build de produção do próprio hotfix | **96/96** |
| `npm audit` (branch 10C) | local | **0** |
| Varredura de segredos (arquivos versionados e histórico) | local | **0 segredos reais** (doc 02, seção 3) |

## 2. Cobertura pedida pela Fase 10C
| Tipo | Como foi coberto |
| --- | --- |
| Unitários e integração | Vitest |
| End-to-end e regressão | Playwright: staging com login real + regressão pública/Portal/Admin |
| Isolamento multitenant | `run.sh` (T-testes), certificado de uma empresa não gira o de outra, uso negado com certificado de outra empresa (`CERT_TENANT_MISMATCH`), C16 |
| RLS | `run.sh` + chamadas diretas ao PostgREST da homologação (C8-C17) |
| RBAC | contador não bloqueia (T225, C15); só o servidor gira (T224, C11); equipe não lê colunas sensíveis (T253, T254, C10b) |
| Segurança | revisão independente (doc 02, seção 5), MFA no banco (aal1 × aal2), lista permanente, chave bloqueada |
| Migrations e rollback (não produtivo) | `run.sh`: aplica 0024 a 0037, testa e reverte até 0024 num banco restaurado |
| Responsividade e acessibilidade | auditoria axe + estouro em 497 combinações |
| Chrome, Safari, Firefox | **só Chrome** (desktop e celular emulado). Firefox e WebKit não instalam no macOS 13 desta máquina |
| Dependências e segredos | `npm audit` + varredura por padrões |

## 3. Problemas achados durante os testes
| Achado | Tipo | Tratamento |
| --- | --- | --- |
| Anônimo tinha permissão de leitura nas tabelas novas (a RLS escondia as linhas, mas a permissão existia) | defesa em profundidade | `revoke all ... from anon` na 0036 |
| 3 achados médios e 7 baixos da revisão independente | segurança | todos corrigidos (doc 02, seção 5) |
| Dois testes da lista de chaves recusavam pelo motivo errado (`42703`, coluna inexistente, por falta de curto-circuito no PL/pgSQL) | teste "verde por acaso" | função reescrita; agora recusam pela regra (`42501`) |
| O gerador de PKI de teste deixava criar um certificado chamado "ca", que sobrescrevia a própria AC | armadilha de teste | o gerador agora recusa nomes reservados |
| 4 testes da 10B montavam a DPS do release 2 sem declarar o destinatário | esperado (mudança de regra) | os rascunhos de teste agora declaram `recipientIsTaker: true` |
| O teste do modelo B usava um registro falso que dizia "certificado da WJB" | esperado (M1 funcionando: `CERT_ROLE_MISMATCH`) | o teste agora registra como certificado de cliente |
| Testes de desktop identificavam o celular pelo nome exato `mobile-chrome` | robustez de teste | generalizado para `mobile-*`, para o iPhone emulado seguir o caminho certo quando a configuração cross-browser rodar |
| **Correção de um relato meu:** eu disse que Firefox e WebKit tinham sido instalados, olhando só o código de saída do comando. A instalação tinha falhado (`does not support firefox on mac13`); a primeira tentativa de regressão neles falhou toda por navegador ausente | registro | relatado como não executado |
| A regressão no Chrome deu 92 em vez de 96 na 1ª execução | ambiente de teste | os 4 testes da Área do Cliente leem a flag da plataforma no processo do Playwright; com a flag também ali, 96/96 |

## 4. Não executado / dependente de credenciais
| Item | Por quê |
| --- | --- |
| Sandbox real da Stripe (11 cenários) | sem chaves de teste (doc 08) |
| Qualquer chamada à SEFIN/ADN, swagger autenticado | sem certificado novo e sem autorização |
| Assinatura e mTLS com certificado real | o certificado exposto nunca é usado; o novo ainda não existe |
| Banco de produção | sem autorização (doc 03 é o checklist para a WJB) |
| Firefox, Safari/WebKit | o Playwright não suporta esses navegadores no macOS 13 desta máquina |
| Aparelhos reais (iPhone, Android) e leitor de tela | nenhum aparelho físico |
| Teclado virtual do celular sobre os formulários | não emulado |
| Desempenho (PageSpeed) depois do hotfix | só depois do deploy |
