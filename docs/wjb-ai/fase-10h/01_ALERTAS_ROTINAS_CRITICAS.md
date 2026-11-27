# Fase 10H - Alertas das rotinas críticas (publicados)

**Situação:** **publicado na `main` e validado** em 27/11/2026, com falha simulada e com execução real.

## 1. O que foi publicado
| Item | Commit na `main` |
| --- | --- |
| Alertas de falha da rotina de lembretes e monitoramento da produção 2 vezes ao dia | `ddb55f81` |
| Alerta de **rotina que deixa de executar**, falha simulada e notificação sem repetição | `70f3172f` |

**Achado antes de publicar:** a branch antiga `hotfix/alertas-rotinas` partia da `main` de **antes** dos hotfixes de segurança, e publicá-la teria **desfeito os dois hotfixes**. Foi refeita sobre a `main` atual como `hotfix/alertas-rotinas-v2`; a antiga ficou intocada.

**Revisão antes da publicação:**
| Exigência | Resultado |
| --- | --- |
| Arquivos modificados | 5: `lembretes-obrigacoes.yml`, `monitoramento-producao.yml`, `alerta-rotina.sh`, `verificar-execucao-rotinas.sh`, `monitorar.sh` |
| Migrations, dados de produção, módulos 10C a 10G | nenhum |
| Permissões | padrão `contents: read`; `issues: write` só nos jobs de alerta (sem segredo); `actions: read` só na verificação de execução; o `CRON_SECRET` só no job dos lembretes |
| Credencial ou dado pessoal em issue, log ou e-mail | não: o issue leva só o nome da rotina, a hora e o link da execução |
| Rollback | reverter os 2 commits (só workflows e scripts) |

## 2. O que é monitorado
| Item pedido | Como | Situação |
| --- | --- | --- |
| Rotina de lembretes | falha da execução → alerta | ativo |
| **Ausência de execução** (mesmo sem erro) | `verificar-execucao-rotinas.sh`: última execução bem-sucedida há mais de 36 h, workflow desligado ou suspenso → alerta | ativo |
| Disponibilidade da aplicação | `monitorar.sh`: 12 páginas, sitemap, robots, imagens | ativo (09:00 e 18:00 de Brasília) |
| Falhas de autenticação | `/login` responde; Portal e Admin exigem login | ativo |
| Segurança | 6 cabeçalhos, 3 leituras; prévias públicas | ativo |
| Formulários | API recusa dado inválido; formulário com POST | ativo |
| Erros críticos nos logs | `monitorar.sh --servidor` (SSH) | **manual**: o GitHub não tem acesso SSH ao servidor (exigiria guardar uma chave da Hostinger nos segredos do GitHub, o que não foi autorizado) |
| Rotinas fiscais, webhooks, integrações (G-Click) | **não se aplica na produção hoje**: módulo fiscal e pagamentos desligados; G-Click roda sob demanda na tela do Admin, sem rotina | quando forem ligados, entram em `ROTINAS` do `verificar-execucao-rotinas.sh` e no monitor |
| Falhas recorrentes | um issue por rotina, comentário no máximo a cada 20 h enquanto a falha continua | ativo |

## 3. Validação (evidência)
| Teste | Resultado |
| --- | --- |
| Falha simulada dos lembretes (`simular_falha`, **sem chamar a produção**) | issue **#2** aberto com o rótulo `alerta-rotina`, só com nome, hora e link |
| Segunda falha simulada | "issue #2 já avisado há menos de 20 h (sem nova notificação)": **sem duplicata** |
| Volta ao normal | o script comentou "voltou a funcionar" e **fechou o issue #2** |
| Monitoramento real pelo servidor do GitHub | **sem falhas**: o CDN da Hostinger não bloqueia o servidor do GitHub |
| Ausência de execução, no GitHub | "última execução bem-sucedida há 20 h": OK |
| Ausência de execução, local: limite de 1 h e workflow inexistente | FALHA com mensagem clara (código 1) |

## 4. Achado: os lembretes chegam à tarde, não às 8h
O agendamento é às 11:00 UTC (08:00 de Brasília). Nas últimas 12 execuções, o GitHub as rodou entre **17:27 e 22:16 UTC**, com 6 a 11 horas de atraso. O próprio GitHub avisa que agendamentos podem atrasar em horários de pico.

**Proposta, decisão da WJB:**
- antecipar o agendamento (por exemplo, para 06:00 UTC); ou
- usar um agendador externo gratuito que chame a mesma rota protegida.

O alerta de 36 h já pega o caso extremo.

## 5. Para receber os avisos
Quem for responsável precisa **acompanhar o repositório** (*Watch → All Activity* ou *Custom → Issues*), com e-mail ligado nas notificações da conta do GitHub.
