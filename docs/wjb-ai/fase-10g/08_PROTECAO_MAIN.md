# Fase 10G - Proteção da branch main

**Situação:** configuração pronta e **não aplicada**. Depende de autorização do administrador do repositório e de um pré-requisito técnico (seção 1).

## 1. Pré-requisito: a CI precisa existir na `main`
As verificações exigidas (`estatico`, `unitarios (22)`, `unitarios (24)`, `banco`, `e2e`) vêm do `.github/workflows/qa.yml`, que hoje só existe nas branches das Fases 10D em diante. **Exigir verificações que não rodam na `main` travaria todo merge.**

Opções:
- **A (recomendada):** publicar só o `qa.yml` na `main` (CI não muda o site). O job `banco` precisa dos scripts de homologação, que também só existem nas branches novas, então ele deve pular quando os scripts não existirem, ou só passar a ser exigido depois do merge da 10C a 10G.
- **B:** aplicar a proteção sem verificações obrigatórias agora (só PR, aprovação, bloqueio de force push e exclusão) e acrescentar as verificações depois do merge.

## 2. Configuração proposta
| Regra | Valor | Motivo |
| --- | --- | --- |
| PR obrigatório | sim, 1 aprovação, aprovação antiga cai com novo commit | revisão de código e de migrations |
| CI obrigatória e branch atualizada | `estatico`, `unitarios (22)`, `unitarios (24)`, `banco`, `e2e`; `strict: true` | segredos, dependências, testes de segurança, isolamento entre empresas, Node 22/24 |
| Force push | bloqueado | histórico |
| Exclusão da `main` | bloqueada | |
| Conversas resolvidas | sim | |
| Administradores | **fora da regra** (`enforce_admins: false`) | manutenção emergencial segura: hotfix de segurança por avanço rápido, com aprovação expressa do PO, como os de 26/11 e 27/11 |

Comando pronto, para quem é administrador, só depois da autorização: doc 09 da Fase 10F, seção 3. Para a opção B, remover o bloco `required_status_checks` (usar `null`).

## 3. Cuidados
- **Prévias da Hostinger:** com PR obrigatório, todo merge passa por PR, e cada PR cria uma prévia. Desde 27/11 o código da `main` responde 421 em qualquer endereço `*.hostingersite.com`, então prévias de branches que partam da `main` atual já nascem bloqueadas. Mesmo assim, **desligar as prévias no painel continua recomendado**: o bloqueio no código é uma proteção a mais, não o isolamento.
- **Revisão de migrations:** o template de PR deve listar as migrations, o rollback e as chaves `WJB_*` (critérios no doc 05 da 10E).
- Hotfix emergencial: branch a partir da `main`, CI verde pela opção `ref` do `qa.yml`, revisão do diff, aprovação do PO e avanço rápido.
