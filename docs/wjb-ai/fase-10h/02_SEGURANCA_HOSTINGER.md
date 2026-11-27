# Fase 10H - Segurança da Hostinger

## 1. Situação verificada em 27/11 (só leitura)
| Item | Resultado |
| --- | --- |
| Prévias no servidor | nenhuma ativa; só `01a21a80` teve modo prévia (removida em 27/11 15:28 UTC) |
| Versões guardadas | só de produção (`Mode: publish`) |
| Endereço da prévia antiga | 404 |
| Domínio temporário `…-794036.hostingersite.com` | página padrão da Hostinger, sem o site |
| Bloqueio por domínio na produção | ativo: qualquer `*.hostingersite.com` recebe 421 em páginas, login e API |
| PRs abertos | nenhum. **Nenhum PR novo** foi aberto nesta fase |
| Prévias automáticas no painel | **ainda ligadas** (só a WJB pode desligar) |

## 2. Instruções para o administrador da Hostinger (desligar as prévias)
1. Entre em **hpanel.hostinger.com** com a conta dona do site.
2. **Websites** → `wjbassessoriacontabil.com.br` → **Painel**.
3. No menu do site, abra a área do **Git** ou de **Implantações** (Deployments), onde aparece o repositório `daniellasantana123-sudo/wjb-assessoria-website-sass`.
4. Procure a opção de **prévias de pull request** (Preview deployments / "Deploy previews for pull requests") e **desligue**. Confirme que a implantação automática da `main` continua ligada (é o deploy do site).
5. Se não encontrar a opção, peça ao suporte (mensagem da seção 3).
6. Avise a equipe técnica para conferir: abrir um PR de teste não deve gerar nenhuma versão em modo prévia.

O caminho exato dos menus não foi conferido por nós (exige o login da WJB).

## 3. Mensagem para o suporte da Hostinger (pronta para enviar pelo chat do hPanel)
> Olá. Sou responsável pelo site wjbassessoriacontabil.com.br, que publica a partir do GitHub (repositório daniellasantana123-sudo/wjb-assessoria-website-sass).
>
> 1. Ao abrirmos um pull request em 26/11/2026, foi criada uma prévia pública em `calm-hotpink-okapi-85.hostingersite.com` usando o mesmo arquivo de variáveis de ambiente da produção. Como **desligamos de vez** as prévias de pull request deste site? Se não for possível desligar, como fazer a prévia usar variáveis próprias, sem as da produção?
> 2. Para investigação de segurança, pedimos os **logs de acesso HTTP** (do servidor e do CDN) com data, hora, IP, método, endereço pedido e código de resposta:
>    - do endereço `calm-hotpink-okapi-85.hostingersite.com`, de 26/11/2026 21:56 a 27/11/2026 15:30 UTC;
>    - do domínio `wjbassessoriacontabil.com.br`, do período mais antigo que vocês tiverem até 27/11/2026 16:00 UTC.
> 3. Por quanto tempo vocês guardam esses logs?
>
> Não precisamos de nenhuma senha nem de acesso adicional. Obrigado.

**Ao receber os logs**, analisar só com contagens, sem copiar dados pessoais:
- pedidos à prévia que não sejam das nossas 4 verificações;
- pedidos com `name=`, `email=` ou `phone=` na URL (ver doc 03);
- pedidos `POST` com cabeçalho `Next-Action` estranho e pedidos a `/_next/image` com `.svg` antes de 26/11 21:48 UTC, quando o site ainda rodava a versão vulnerável do Next.js.

## 4. Isolamento entre produção e homologação
| Ambiente | Banco | E-mail | G-Click | Credenciais |
| --- | --- | --- | --- | --- |
| Produção (Hostinger) | `hlyukumgyzswfndlzwcf` | Resend | real (interruptor) | `.env` do painel |
| Homologação (local, `staging.sh`) | `uisoyodnzdyaaxisujmk` | desligado | desligado | `.env.homolog*.local`; os scripts **recusam** qualquer valor da produção |
| CI do GitHub | Postgres descartável | - | - | **nenhuma** |
| Prévia da Hostinger (se reativada) | **produção** (mesmo `.env`) | produção | produção | - (bloqueada por domínio no código) |

**Falta para o isolamento completo:** desligar as prévias (seção 2). O bloqueio por domínio continua sendo proteção complementar, não substituto.

## 5. Rotação de credenciais
| Credencial | Exposição avaliada | Decisão proposta |
| --- | --- | --- |
| Supabase (chave de serviço, anon), Resend, G-Click, `CRON_SECRET` | ficaram só no servidor da prévia; nenhum segredo no código enviado ao navegador; os 4 inícios da prévia foram nossos | **não girar agora** |
| Gatilho para girar | o log de acesso (seção 3) mostrar pedido à prévia que não seja nosso | girar primeiro o `CRON_SECRET` (Hostinger + GitHub), depois Resend e Supabase |
