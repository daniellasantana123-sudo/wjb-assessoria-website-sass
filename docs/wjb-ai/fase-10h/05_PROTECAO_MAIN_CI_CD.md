# Fase 10H - CI publicada e proteção da main

## 1. CI na main (publicada e executada)
| Item | Evidência |
| --- | --- |
| Publicação | `qa.yml` na `main` em `e2576a38` (27/11, 16:28 UTC), só a CI, nenhum módulo novo |
| Validação antes | CI na própria branch `hotfix/ci-qualidade`: 5 jobs verdes, 227 testes E2E |
| **Execução na `main`** | push `e2576a38`: `estatico`, `unitarios (22)`, `unitarios (24)`, `banco`, `e2e`, **todos verdes** |
| Job `banco` na `main` | passa com aviso enquanto a `main` não tem os scripts de homologação (só depois do merge da 10C); na branch da 10H roda tudo (migrations 0001 a 0038, RLS, isolamento, backup, rollback) |
| Deploy disparado pelo push | versão `01a21dd6` (site inalterado); validação pós-deploy sem falhas |

O que a CI verifica: lint, tipos, **detecção de segredos**, **`npm audit --omit=dev`** (vulnerabilidades), unitários em Node 22 e 24, **migrations, RLS e isolamento entre empresas** (job `banco`), build com verificação do artefato, **E2E** em Chromium, Firefox, WebKit e iPhone emulado.

## 2. Proteção da main: pronta, NÃO aplicada
Condições do PO: (a) CI executando na `main`: **cumprida**; (b) risco das prévias resolvido: **não cumprida** (as prévias automáticas continuam ligadas no painel). Por isso a proteção não foi aplicada.

Assim que a WJB confirmar que desligou as prévias, o administrador aplica (comando completo no doc 09 da Fase 10F, seção 3):
| Regra | Valor |
| --- | --- |
| PR obrigatório | sim, **1 aprovação independente**, aprovação antiga cai com novo commit, conversas resolvidas |
| Verificações obrigatórias | `estatico`, `unitarios (22)`, `unitarios (24)`, `banco`, `e2e`, branch atualizada |
| Force push e exclusão | bloqueados |
| Administradores | fora da regra (`enforce_admins: false`), só para o hotfix emergencial da seção 3 |

## 3. Hotfix emergencial seguro e auditável
1. Branch `hotfix/...` a partir da `main` atual. Conferir com `git merge-base --is-ancestor`: a branch de alertas antiga partia de uma `main` velha e teria desfeito os hotfixes de segurança.
2. CI verde na própria branch (o `qa.yml` roda em `hotfix/**`).
3. Revisar o diff: arquivos, ausência de migrations e de módulos não autorizados.
4. Aprovação expressa do PO, registrada no relatório.
5. Avanço rápido da `main`, **sem PR enquanto as prévias estiverem ligadas**.
6. Validação pós-deploy: `monitorar.sh --servidor` e `validar-gtm.mjs`.
7. Registro: commit, versão da Hostinger, horário, resultado (como no doc 01 da 10G).
