# Fase 10F - Checklist de publicação

**Nada foi publicado.** A `main` continua em `70d08787` e a produção na versão `01a21a76`. Cada etapa abaixo depende de **autorização específica** do Product Owner.

## 1. O que está pronto para publicar
| Pacote | Branch (a partir da `main`) | Conteúdo | Migration | Testes |
| --- | --- | --- | --- | --- |
| **A. Bloqueio das prévias** | `hotfix/bloqueio-previas-hostinger` | servidor só atende o domínio oficial e o ambiente local (421 para o resto) | não | regressão local 96/96; CI nos 4 navegadores verde (os 4 instáveis são o defeito de formulário que o pacote B corrige) |
| **B. Formulários** (privacidade) | `hotfix/formularios-post-hidratacao` | POST só depois de carregado, texto digitado preservado, dados vazados retirados da URL antes do GTM | não | regressão local 106/106; CI nos 4 navegadores verde, **0 instáveis** |
| C. Fases 10C a 10F | `feature/wjb-fase-10f` | módulo fiscal, comercial, pagamentos, certificado, cofre, origem de cobrança | 0024 a 0038 (doc 06 da 10E + 0038) | ver doc 00 |

A e B combinam **sem conflito** entre si e com a 10F (conferido com `git merge-tree`). Nenhum dos dois inclui funcionalidade das Fases 10C a 10F; levam só cópias idênticas de arquivos de teste e de CI.

## 2. Ordem recomendada
1. **Antes de tudo:** desligar as prévias da Hostinger (doc 01) **ou** publicar A primeiro.
   - **Atenção:** abrir PR hoje cria uma prévia com o `.env` da produção. O PR de A é seguro (a prévia dele já nasce bloqueada pelo próprio código). O PR de B, sem A, não é.
2. **A + B juntos** (recomendado), em um de dois jeitos:
   - avanço rápido da `main` para um commit que una A e B, sem PR, como foi feito no hotfix do Next.js; ou
   - PR a partir de uma branch que contenha A, **depois** de desligar as prévias.
3. **C** só depois da auditoria do banco (doc 02), da proteção da `main` (doc 09) e de backup testado. Migrations em lotes, com as chaves `WJB_*` desligadas.

## 3. Antes do deploy de A
- [ ] Autorização expressa.
- [ ] Confirmar que o domínio chega ao Node com `Host: wjbassessoriacontabil.com.br`. Evidência indireta já existe: o redirecionamento de `www`, que depende do `Host`, funciona em produção. Saída de emergência sem redeploy: `WJB_ALLOWED_HOSTS` no painel.
- [ ] Ter à mão o rollback: `git revert` do commit + push (a Hostinger recompila a versão anterior; nunca voltar para antes do Next.js 16.4.6).

## 4. Depois do deploy (A e B)
- [ ] `bash scripts/wjb-ai/producao/monitorar.sh --servidor` sem falhas. Ler os cabeçalhos **mais de uma vez**: logo depois da troca de versão, uma leitura isolada engana.
- [ ] O monitor deve mostrar "formulário de contato com method=post" (deixa de ser AVISO).
- [ ] A prévia que já existe (código da 10C) **continua aberta** até ser apagada ou recompilada: o bloqueio só vale para builds que o contenham.
- [ ] Teste de envio do formulário combinado com a WJB (um lead de teste).
- [ ] Login do Portal e do Admin com MFA (pessoa da WJB).
- [ ] No dia seguinte: rotina de lembretes com `ok: true` no GitHub Actions.

## 5. Depois do merge da 10F (quando autorizado)
- [ ] Os workflows `lembretes-obrigacoes.yml` (com alerta) e `monitoramento-producao.yml` passam a valer, porque o GitHub só agenda a partir da `main`. Conferir o primeiro issue de alerta (ou a ausência dele).
- [ ] Migrations em lotes (doc 06 da 10E), agora até a **0038**, cada uma com backup testado.
- [ ] Chaves `WJB_*` continuam **desligadas** até decisão.

## 6. Exposição em logs e analytics (formulários)
| Onde | Situação |
| --- | --- |
| URL do navegador e histórico | B passa a retirar os campos ao abrir um link antigo |
| GA4/GTM (`page_location`) | o GTM só carrega com consentimento, e B limpa a URL **antes** dele. Antes de B, um envio antecipado de quem aceitou cookies pode ter mandado nome, e-mail ou telefone ao GA4. **Ação da WJB:** no GA4, procurar `page_location` com `email=` ou `phone=` e, se houver, usar a solicitação de exclusão de dados do GA4 |
| Logs da aplicação (Hostinger) | **verificado em 27/11**, só contagens, nas 4 versões guardadas (10/11 em diante, 455 linhas): **0** ocorrências de `email=`, `phone=`, `name=` ou de endereço de e-mail; `stderr` vazio. O Next.js não registra a URL dos pedidos |
| Log de acesso do CDN e do servidor | não disponível por SSH; pedir à Hostinger junto com o pedido do doc 02 da 10E |
