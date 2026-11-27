# Fase 10F - Status do roadmap, testes e evidências

**Data:** 27/11/2026. **Branch:** `feature/wjb-fase-10f` (a partir da 10E). **Hotfixes** (a partir da `main`, sem PR): `hotfix/bloqueio-previas-hostinger`, `hotfix/formularios-post-hidratacao`. **Produção:** `main` = `70d08787`, versão Hostinger `01a21a76`, sem mudança. **PR #1:** rascunho. Nenhum PR novo e nenhuma prévia nova.

## 1. Roadmap (reclassificado)
| Frente | Status | Evidência |
| --- | --- | --- |
| Segurança das prévias da Hostinger | **P0, AGUARDANDO DECISÃO** da WJB; bloqueio pronto no hotfix A | doc 01 |
| Hotfix dos formulários (privacidade) | **P0, PRONTO**, aguardando autorização de deploy | doc 08; CI nos 4 navegadores, 0 instáveis |
| Auditoria do banco de produção | **P0, AGUARDANDO** a WJB rodar o script; chamado ao Supabase pronto | doc 02 |
| Alertas de rotinas críticas | **CONCLUÍDO** (código e testes); vale depois do merge | doc 02, seção 6 |
| Stripe | **DESBLOQUEADO para Sandbox**; aguardando as chaves de teste | doc 03 |
| Pagamentos recorrentes, avulsos, reembolso | **EM TESTES** (simulado, unitário, homologação); Sandbox pronto | doc 03 |
| Conciliação com o Omie e origem única de cobrança | **EM TESTES** (0038 só na homologação) | doc 07 |
| Infraestrutura do certificado A1 | **DESBLOQUEADA** e testada com certificados fictícios | doc 04 |
| Certificado real | **AGUARDANDO SUBSTITUIÇÃO SEGURA** (novo par de chaves) | doc 04 |
| Cofre | **DESENVOLVIMENTO DESBLOQUEADO**, contratação pendente (≈ US$ 1 a 2/mês) | doc 05 |
| NFS-e | **DESENVOLVIMENTO DESBLOQUEADO**, operações reais bloqueadas; contrato conferido no manual oficial | doc 06 |
| Preços comerciais (honorários e serviços avulsos) | **AGUARDANDO APROVAÇÃO** | doc 09, seção 4 |
| Proteção da `main` | **AGUARDANDO AUTORIZAÇÃO** (comando pronto) | doc 09, seção 3 |

## 2. Testes
| Bateria | Onde | Resultado |
| --- | --- | --- |
| Unitários (10F) | local | **763/763** (+34 nesta fase) |
| Banco: migrations 0001 a 0038, RLS, isolamento, MFA, backup, rollback 0038 → 0024 | Postgres 17 descartável (Docker) | **sem falhas**; 0038: T260 a T272 |
| Hotfix A (prévias): lint, typecheck, teste do bloqueio, build, regressão E2E | local | 5/5 do bloqueio; E2E 96/96 (20 pulados por exigirem credenciais); unitários completos na CI (Node 22 e 24) |
| Hotfix A: bloqueio com `Host` simulado no build de produção | local | prévia e endereço desconhecido = 421; domínio oficial e localhost normais |
| Hotfix A: CI em Chromium, Firefox, WebKit e iPhone emulado | GitHub (Linux) | verde; 4 instáveis no formulário de contato (o defeito que o hotfix B corrige) |
| Hotfix B (formulários): lint, typecheck, unitários, build, regressão | local | 376/376 (+3); E2E 106/106 |
| Hotfix B: CI nos 4 navegadores | GitHub (Linux) | **verde, 219 aprovados, 0 instáveis** |
| Staging na homologação (login real com MFA): NFS-e, Admin, Fases 7 a 10C e **certificado público (10F)** | Supabase de homologação | **49/49** |
| Staging: pagamentos simulados, com **reembolso** e **origem de cobrança** (10F) | Supabase de homologação | **11/11** |
| Staging: webhook com assinatura | Supabase de homologação | **2/2** |
| CI da branch 10F (lint, tipos, segredos, auditoria, unitários 22/24, banco, E2E nos 4 navegadores) | GitHub (Linux) | **verde** |
| CI final do hotfix B | GitHub (Linux) | **verde** |
| CDN: `Host` trocado contra prévia e produção | produção, só GET | derrubado pelo CDN (HTTP/1.1 e HTTP/2) |
| Logs da aplicação: dados de formulário | produção, só contagens | **0** ocorrências em 455 linhas |
| Monitoramento da produção | produção, só leitura | sem falhas; AVISO da prévia aberta |
| Revisão de segurança independente (agente) | código | sem crítico nem alto; médios tratados (doc 01 e 03) |

## 3. Bugs e defeitos corrigidos nesta fase
1. Quatro testes da `main` só pulavam no `mobile-chrome` e falhavam no iPhone emulado (o menu de computador e as setas do carrossel não existem no celular). Era teste, não defeito do site.
2. A URL de retorno do Checkout usava `X-Forwarded-Host`, que pode vir do navegador.
3. `issues: write` valia para o workflow inteiro, inclusive o job com segredo; agora só no job de alerta.
4. A mensagem de falha do reembolso podia dizer "nada foi devolvido" quando a devolução tinha acontecido.
5. Achado durante o staging: uma execução interrompida deixava uma origem de cobrança "outro meio" ativa e, na execução seguinte, a contratação da empresa de teste era recusada (comportamento correto do sistema). O teste passou a limpar as origens no início, como já fazia com as assinaturas.
6. O contrato da API Nacional marcava a URL base como confirmada sem fonte, e o caminho de eventos como pendente apesar de estar no manual oficial.

## 4. Funcionalidades novas
Bloqueio de endereços não autorizados; limpeza de dados de formulário na URL; reembolso de teste; origem única de cobrança (0038); conferência do certificado público; consulta da NFS-e pela chave; alertas de rotinas pelo GitHub; monitoramento agendado da produção; CI que testa outra branch (`ref`).

## 5. Não testado
- Stripe real (sem chaves); Safari num iPhone ou Mac real; qualquer operação no banco de produção; o monitoramento agendado a partir do GitHub (só depois do merge); a cadeia ICP-Brasil e a revogação reais (não configuradas, por desenho).
