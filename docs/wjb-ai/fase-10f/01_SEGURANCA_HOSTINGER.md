# Fase 10F - Segurança das prévias da Hostinger (P0)

**Data:** 27/11/2026. Tudo só leitura no servidor. Nenhuma configuração da Hostinger ou do GitHub foi alterada, e o PR #1 continua em rascunho.

## 1. Situação encontrada
| Item | Evidência (27/11, 13:47 UTC) |
| --- | --- |
| Prévias existentes | **Uma só**: `calm-hotpink-okapi-85.hostingersite.com` (versão `01a21a80`, branch `feature/wjb-fase-10c`, log de build com `Mode: preview`). Nenhuma outra versão em modo prévia em `hbuilds/logs` |
| Produção | `current` → `01a21a76` (hotfix Next.js 16.4.6), sem mudança |
| Outro endereço da conta | `wjbassessoriacontabil-com-br-794036.hostingersite.com`: domínio temporário criado em 18/09, serve só a página padrão da Hostinger (`default.php`); `/login` e `/api/leads` dão 404. **Não roda o site** |
| Pushes desta fase | `hotfix/formularios-post-hidratacao`, `hotfix/bloqueio-previas-hostinger` e `feature/wjb-fase-10f` foram enviados **sem PR**: nenhuma prévia nova (confirmado em `hbuilds/versions`) |
| Configuração da prévia | mesmo `PassengerAppRoot` dentro de `hbuilds/versions/…`, mesmo `preload-timestamp.js` e o **mesmo `hbuilds/config/.env`** da produção |

## 2. Houve acesso indevido à prévia?
O servidor da Hostinger (lsnode) só inicia o processo da prévia quando chega um pedido, e o encerra depois de 300 s parado. Cada início fica registrado no `console.log` da versão.

| Início do processo (UTC) | Origem provável |
| --- | --- |
| 27/11 01:37 | verificação da prévia feita por nós na Fase 10E (22h37 de Brasília) |
| 27/11 13:46 | verificação desta fase (`curl` de 3 endereços) |

- **Só dois inícios desde a criação**, os dois compatíveis com as nossas verificações. Nenhum erro, nenhum pedido de API registrado, `stderr.log` vazio.
- **Limite:** sem o log de acesso HTTP, que a Hostinger não expõe por SSH, não dá para provar a origem de cada pedido. Dentro de uma mesma janela de 300 s, outros pedidos não gerariam novo início.
- **Evidências preservadas:** os originais continuam intactos no servidor. O sha256 de cada um, tirado em 27/11, está versionado em `docs/wjb-ai/fase-10f/evidencias/previa-sha256.txt`. Há uma cópia local (fora do Git, por ser `.log`) do log de build e do `console.log` da prévia, conferida sem segredo nem dado pessoal, disponível para o chamado. O sha256 do `console.log` muda a cada novo início do processo.

## 3. Algum segredo vazou pela prévia?
Varredura do código que a prévia envia ao navegador (`.next/static`), só contagens:

| Busca | Resultado |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `CRON_SECRET`, `GCLICK_CLIENT_SECRET`, `SUPABASE_ANON_KEY` | 0 arquivos |
| `sb_secret_`, `sk_live_`, `sk_test_`, chave privada | 0 |
| Padrão de chave do Resend (`re_` + 20 caracteres) | 0 (o único `re_` era um nome interno do bundler) |
| Source maps | 0 |

**Avaliação da rotação de credenciais:** não há indício de vazamento: os segredos ficam no servidor, fora do código enviado ao navegador, e não há sinal de acesso de terceiros. **A rotação não é necessária pelos fatos levantados.** O risco da prévia é de **uso**: um login ou contato feito ali grava na produção, com código não aprovado. Se a prévia continuar no ar por muito tempo ou se surgir indício novo, girar primeiro o `CRON_SECRET` (o mais simples: Hostinger + segredo do GitHub) e depois a chave do Resend.

## 4. Controle de ambiente que falha de forma segura (implementado)
A prévia e a produção têm **exatamente as mesmas variáveis**: nenhuma variável distingue uma da outra. O que distingue é o **endereço pedido** (cabeçalho `Host`).

- `src/lib/security/allowed-hosts.ts` + primeira verificação do `src/proxy.ts`: o servidor só atende `wjbassessoriacontabil.com.br` (com e sem `www`) e o ambiente local (`localhost`, `127.0.0.1`, `::1`). **Qualquer outro endereço recebe 421**, antes de sessão, banco, e-mail ou G-Click.
- Host ausente ou malformado = recusa. `*.hostingersite.com` **nunca** é liberado, nem pela variável opcional `WJB_ALLOWED_HOSTS` (lida em tempo de execução, para um domínio de homologação futuro).
- Ficam de fora só o que não toca dado nem segredo: arquivos estáticos, imagens otimizadas, `sitemap.xml` e `robots.txt`.

**Testado com o build de produção** (`next start`, cabeçalho `Host` simulado):

| Host | `/` | `/login` | `/api/leads` |
| --- | --- | --- | --- |
| `calm-hotpink-okapi-85.hostingersite.com` | 421 | 421 | 421 |
| `evil.com` | 421 | 421 | 421 |
| `wjbassessoriacontabil.com.br` | 200 | 200 | 405 (GET) |
| `www.wjbassessoriacontabil.com.br` | 308 | 308 | 308 |
| `localhost:3000` | 200 | 200 | 405 |

**Revisão de segurança independente (agente `wjb-security`):** sem achado crítico ou alto. Dois pontos médios foram verificados ou tratados:
- **`Host: localhost` enviado de fora:** testado contra o CDN (27/11). Pedidos em que o `Host` difere do endereço do certificado são **derrubados pelo CDN** (resposta vazia), tanto na prévia quanto na produção, em HTTP/1.1 e HTTP/2 (`PROTOCOL_ERROR`). O pedido nem chega ao servidor; os endereços locais continuam liberados para desenvolvimento e testes.
- **`Host` diferente vindo do CDN derrubaria a produção:** o redirecionamento de `www`, que depende do `Host`, funciona em produção, então o `Host` chega correto. Se algo mudar, `WJB_ALLOWED_HOSTS` libera sem redeploy.
- Também corrigido: a URL de retorno do Checkout deixou de usar `X-Forwarded-Host`, que pode vir do navegador; agora só o `Host` já conferido.

**Importante:** o bloqueio só vale para builds feitos a partir de código que o contenha. A prévia que já existe (código da 10C) **não** o tem. Por isso ele está num hotfix próprio, `hotfix/bloqueio-previas-hostinger`, a partir da `main`: publicado, toda branch futura herda a proteção.

## 5. Decisão necessária da WJB
| Opção | Efeito | Observação |
| --- | --- | --- |
| **A. Desligar as prévias no painel da Hostinger** (recomendado) e apagar a prévia existente | resolve agora e para sempre | não verifiquei o caminho exato no hPanel (exige login da WJB); procurar nas configurações de Git/Implantações do site |
| B. Fechar o PR #1 | a prévia deve sair; o PR pode ser reaberto | branches e commits continuam; **não é merge** |
| C. Publicar o hotfix de bloqueio (autorização de deploy) | toda prévia futura passa a responder 421 | a prévia atual só fecha se for recompilada; isso exigiria push na branch da 10C, o que **não fiz** |
| D. Aceitar o risco por escrito | nada muda | prévia grava na produção |

**Recomendação:** A agora, e C junto com o hotfix dos formulários (doc 08). Até lá: **nenhum PR novo**, e nenhum push na branch do PR #1.

## 6. Monitoramento
`scripts/wjb-ai/producao/monitorar.sh` passou a verificar a prévia: AVISO enquanto `/login` da prévia responder 200; OK quando responder 421 ou 404. Resultado de hoje: AVISO (prévia no ar).
