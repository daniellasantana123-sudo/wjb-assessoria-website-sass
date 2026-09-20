# Handoff - Fase 6.5 para a próxima fase

## Respostas às 12 perguntas do prompt

1. **Estamos realmente integrando com a API Omie.G-Click correta?** Não ainda - a implementação da Fase 4 usava a API do Omie ERP por engano. Foi removida. Hoje não existe nenhuma chamada real a nenhuma API.
2. **O modelo de autenticação está correto?** Não estava (par de chaves por request, modelo do Omie ERP). O modelo real da G-Click (token via "gerar credenciais") foi identificado, mas os parâmetros exatos não estão confirmados.
3. **As variáveis de ambiente representam as credenciais corretas?** Não representavam - removidas. Nenhum nome novo foi confirmado ainda.
4. **O Adapter segue a documentação oficial?** Não seguia (Omie ERP). Hoje o adapter não implementa nenhuma chamada real - é seguro por padrão até a especificação certa ser confirmada.
5. **O mapping por tenant é seguro?** Sim - validado, sem gaps encontrados.
6. **Existe algum endpoint inventado?** Não - o endpoint usado era real (Omie ERP), só errado para este propósito. Nenhum payload/schema foi inventado nesta fase.
7. **Existe algum recurso partner-only sendo usado indevidamente?** Não - "Responder atividade" e "Criar pré-tarefa com tag" (`partner_only`) nunca foram implementados.
8. **O Portal Contábil está correto?** Estava com uma premissa errada (URL por tenant); corrigido para usar a URL real e única confirmada.
9. **A indisponibilidade da Omie não derruba o SaaS?** Confirmado - e agora ainda mais garantido, já que não há mais nenhuma chamada de rede real acontecendo.
10. **Podemos configurar credenciais reais sem mudar a arquitetura?** A arquitetura (mapping, RLS, permissões, feature flag, UI) está pronta para receber uma implementação real sem mudança estrutural - só falta escrever essa implementação (um novo `gclick.adapter.ts`) quando o schema técnico for confirmado.
11. **O que exatamente devemos pedir à Omie?** Ver `omie-contact-checklist.md` - acesso à documentação técnica completa, confirmação do modelo de credenciais, host real da API, e status do programa de parceiros para os 2 recursos `partner_only`.
12. **Estamos tecnicamente prontos para iniciar Production Readiness?** Ver seção "Leitura do gate" abaixo - depende de como a Fase 7 escopa essa pergunta (SaaS inteiro vs. esta integração específica).

## Leitura do gate da Parte 22 (Fase 7)

O prompt autoriza Fase 7 a iniciar só com `VALIDATED` ou `BLOCKED_BY_CREDENTIALS` (com condições). Esta auditoria classificou a integração como `BLOCKED_BY_PROVIDER` - um terceiro estado que o prompt não lista explicitamente como autorizado a prosseguir.

Ao mesmo tempo, TODOS os itens da lista de bloqueio explícita da Parte 22 (`critical security gap`, `wrong API`, `wrong authentication model`, `cross-tenant vulnerability`, `secret exposure`, `unknown production behavior that affects core SaaS`) foram corrigidos ou confirmados ausentes nesta fase. O que resta pendente é estritamente contido à integração Omie.G-Click (que já era opcional, com feature flag, e nunca afetou login/Dashboard/Documentos).

**Não presumi a resposta a essa questão de escopo** - se "Fase 7 - Production Readiness" no plano da WJB significa "todo o SaaS pode ir pra produção, exceto a sincronização real com o G-Click (que fica documentada como pendência conhecida)" ou "nada avança até o G-Click estar 100% funcional" é uma decisão de produto, não técnica. Recomendo que o usuário confirme essa leitura antes do próximo prompt numerado avançar para a Fase 7.

## O que está pronto

- Diagnóstico técnico completo e honesto sobre a integração Omie.G-Click.
- Implementação incorreta removida, sem nenhuma chamada de rede real remanescente.
- CTA do Portal corrigido com a URL real confirmada.
- Toda a arquitetura ao redor (mapping, RLS, permissões, feature flag, resiliência, auditoria) revalidada e preservada.
- Checklist de perguntas para a Omie, pronto para a WJB usar no contato comercial/técnico.

## O que ficou deliberadamente fora desta fase

- Reimplementação real do Adapter - bloqueada por falta de especificação técnica confirmada, não por falta de esforço.
- "Tarefas"/"pré-tarefas" - mesma razão, mais 2 sub-recursos explicitamente `partner_only`.
- Nomes de variável de ambiente definitivos - não inventados sem confirmação (ver `decisions.md` D2).

## Pendências herdadas de fases anteriores (ainda não resolvidas)

- Credenciais do projeto Supabase real continuam ausentes - toda a validação de RLS/cross-tenant desta fase foi por leitura de código, não contra banco real.
- `.env.example`/`.github/workflows/` continuam ausentes (Fase 0).

## Riscos

- **A validação de cross-tenant/tenant-suspenso/membership-suspensa não foi executada contra um banco real** - é a mesma limitação herdada desde a Fase 0. A lógica é idêntica à já usada (e parcialmente testada) em `documents`/`obligations`, mas "idêntica por leitura de código" não é o mesmo que "testada ao vivo".
- **O host real da API da G-Click continua desconhecido** - qualquer suposição futura precisa vir da documentação técnica real (Postman) ou de contato direto com a Omie, nunca de inferência.

## Próxima fase

Não definida - aguardando o próximo prompt numerado do usuário. Se for a Fase 7, recomendo que o usuário primeiro confirme a leitura do gate acima (seção "Leitura do gate da Parte 22").
