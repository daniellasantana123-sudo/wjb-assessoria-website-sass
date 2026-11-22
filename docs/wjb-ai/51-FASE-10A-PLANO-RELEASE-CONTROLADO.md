# 51 - Plano de publicação controlada (revisado na Fase 10A.1; NADA executado)

**Princípios:**
- Publicar código não é ativar serviço: todo recurso novo chega **desligado** e só liga por interruptor, com aprovação própria.
- Cada etapa precisa de **autorização específica** da WJB.
- Depois de qualquer gravação real, "voltar atrás" no banco significa **restaurar backup**, não rodar rollback.

**Bloqueio atual:** o banco de produção está sem tabelas visíveis e com 0 usuários (doc 54). As etapas B, D, E e F esperam a resolução. **A etapa A pode seguir**, porque não toca no banco.

## Etapa A: atualização de segurança do site atual
| | |
| --- | --- |
| O quê | branch `hotfix/next-16.4.6-security` (`70d08787`): Next.js 16.4.6, zod 4.6.7 e transitivas. Nada da WJB AI |
| Pré-verificação | aprovação; confirmar no hPanel o Node da aplicação (20, 22 ou 24, todos compatíveis); anotar a versão ativa em `hbuilds/current` |
| Execução (quando autorizada) | merge do hotfix na `main` → deploy automático da Hostinger |
| Critérios de aprovação | log do deploy com "Compiled successfully" (com o download de `@next/swc-wasm-nodejs@16.4.6`); site 200 em `/`, `/planos`, `/contato`, `/blog`; formulário de contato enviando (e-mail chega); `stderr.log` da nova versão sem erro |
| Monitoramento (24 h) | `stderr.log`, envios de formulário, PageSpeed |
| Recuperação | reverter o commit na `main` (redeploy da versão anterior). Se o build falhar, a versão anterior continua ativa (`current` só muda com sucesso; conferir no primeiro deploy) |

## Etapa B: proteção adicional dos formulários
| | |
| --- | --- |
| O quê | limites de tamanho, limite de 16 mil caracteres no corpo, escape do e-mail, assunto sem quebra de linha, `poweredByHeader` + migration **0034** (limite compartilhado e índices) |
| Pré-verificação | banco de produção saudável (doc 54); backup testado; aprovação |
| Critérios | 0034 aplicada numa transação; formulário envia; 6ª requisição no minuto dá 429; contador no banco só com hash |
| Monitoramento | taxa de 429 (falso positivo?), envios por hora |
| Recuperação | rollback 0034 (só perde contadores) e reverter o commit. Sem 0034, o código já cai no contador em memória |

## Etapa C: código da WJB AI com tudo desligado
| | |
| --- | --- |
| O quê | Fases 2-10A.1 na `main`, **sem** `WJB_AI_ENABLED`, `WJB_COMMERCIAL_ENABLED` nem `WJB_PAYMENTS_ENABLED` no painel |
| Pré-verificação | etapas A e B estáveis; aprovação das mudanças de comportamento: MFA exigido nas APIs para quem tem MFA (`getVerifiedSession`) e o novo aviso de reconfirmação |
| Critérios | regressão 96/96; rotas novas com 404; login, Portal, Admin e G-Click iguais; MFA funcionando para a equipe |
| Monitoramento | erros 4xx/5xx no `stderr.log`, logins |
| Recuperação | reverter o merge na `main` |

## Etapa D: migrations 0024-0033 (+0035) em lotes
| Lote | Migrations | Regra |
| --- | --- | --- |
| D1 | 0024-0029 numa transação | nunca 0024 sem 0027 |
| D2 | 0030 + 0031 | nunca 0030 sozinha |
| D3 | 0032 | preços versionados |
| D4 | 0035 | MFA no banco: exige MFA ativado na equipe antes (doc 52) |
| D5 | 0033 | só com pagamentos de teste aprovados |

| | |
| --- | --- |
| Pré-verificação | **backup testado** (restaurado num projeto separado) antes de cada lote; conferir o histórico real das migrations; aprovação por lote |
| Critérios | o equivalente ao `run.sh` contra a cópia; RLS em 100%; telas atuais intactas |
| Recuperação | antes de qualquer uso real: scripts de rollback em ordem reversa. Depois: **restaurar backup** |

## Etapa E: ativação controlada
| | |
| --- | --- |
| O quê | ligar **um** interruptor por vez (ex.: `WJB_AI_ENABLED` só para a equipe; depois `WJB_COMMERCIAL_ENABLED` com a página `/emissao-de-notas`) |
| Pré-verificação | D aplicada; jurídico dos textos públicos; aprovação por interruptor |
| Critérios | fluxo ponta a ponta com usuário real da WJB; auditoria registrando |
| Monitoramento | `audit_log`, alertas da fila (rotina agendada) |
| Recuperação | **desligar o interruptor** (vale na hora, sem redeploy) |

## Etapa F: pagamentos e emissão fiscal
| | |
| --- | --- |
| O quê | Stripe em teste na produção e, depois, live (migration e configuração próprias); emissão oficial (Fase 10B) |
| Pré-verificação | Sandbox real aprovado; contratos, tributação e conta Stripe ativa; certificado e-CNPJ, cofre e homologação oficial na produção restrita |
| Critérios | doc 47 (pagamentos) e docs 29-31 (fiscal) |
| Recuperação | interruptores; live bloqueado no banco até nova migration |

## Rollback de configuração
Nenhuma etapa A-D exige variável nova na Hostinger. As etapas E e F só **adicionam** interruptores: remover a variável desliga o recurso.
