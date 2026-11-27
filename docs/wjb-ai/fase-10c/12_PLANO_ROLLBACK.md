# Fase 10C - Plano de rollback

Cada mudança tem um caminho de volta **testado ou documentado**. Nada desta fase foi publicado. A produção continua na `main` (`a7d15d22`) e o banco de produção não foi tocado.

## 1. Hotfix do Next.js (`hotfix/next-16.4.6-security`, `70d08787`)
| Etapa | Ação | Rollback |
| --- | --- | --- |
| Merge na `main` (que é o deploy na Hostinger) | só com autorização específica | `git revert <merge>` + push. A Hostinger rebuilda a versão anterior (16.3.7) |
| Depois do deploy | conferir o log "Compiled successfully", o site com 200, o formulário de contato enviando, o login do Portal e o `stderr.log` limpo | se algo falhar, reverter na hora. O banco não muda nesta etapa |

A 16.3.7 tem advisories críticos (doc 02), então o rollback é só uma medida de emergência, não um estado para manter.

## 2. Código da Fase 10C (branch `feature/wjb-fase-10c`)
Não está publicado. Quando for, o rollback é reverter o merge.

Tudo da WJB AI continua desligado por variável de ambiente lida em runtime:
- `WJB_AI_ENABLED`: desligado, a tela de certificados e as rotas novas respondem 404;
- `WJB_AI_OFFICIAL_TRANSMISSION_ENABLED`;
- `WJB_PAYMENTS_ENABLED`.

Desligar uma variável desfaz o efeito **sem redeploy**.

## 3. Migrations 0036 e 0037 (ciclo de vida do certificado)
- **Onde está:** só no banco local de testes e na homologação. Nunca na produção.
- **Rollback testado:** `27_rollback_0037.sql` (restaura as funções da 0036) e `25_rollback_0036.sql`, no `run.sh`. Ele aplica 0024 a 0037 e depois reverte da 0037 à 0024 num banco restaurado, conferindo que volta ao estado anterior byte a byte (contagens e esquema).
- **Atenção:** a lista de bloqueio é **permanente por desenho**. O rollback apaga a tabela inteira e só deve ser usado em banco de testes. Na produção, um rollback que apagasse a lista desbloquearia certificados comprometidos. Se algum dia for preciso reverter a 0036 na produção:
  1. exportar a lista;
  2. recriar a tabela;
  3. reimportar antes de religar o uso de certificados.
- Na homologação, a 0036 e a 0037 foram aplicadas com backup automático antes de cada uma (`.homolog-backups/`).

## 4. Banco de produção
Nenhuma operação nesta fase. O rollback da recuperação, quando houver, está no doc 04, seção 3: o projeto antigo é mantido por 30 dias e as variáveis da Hostinger voltam.

## 5. Configurações e serviços externos
| Item | Rollback |
| --- | --- |
| Cofre (quando contratado) | revogar a credencial de leitura do servidor; o código volta a recusar (falha fechada) |
| Chaves de teste da Stripe | apagar o `.env.stripe.local` e revogar a chave no Dashboard de teste |
| Configuração `playwright.crossbrowser.config.ts` | arquivo opcional, fora do CI; apagar não afeta nada |
