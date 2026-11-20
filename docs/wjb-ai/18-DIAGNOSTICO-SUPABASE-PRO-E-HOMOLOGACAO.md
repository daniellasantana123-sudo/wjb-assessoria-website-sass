# 18 - Diagnóstico do Supabase Pro e plano de homologação (Fase A)

**Data:** 20/11/2026 · **Modo:** somente leitura (painel do Supabase no navegador do proprietário, sem abrir páginas de chaves; repositório; documentação oficial). **Nada foi criado, alterado ou pago.**

## 1. Fatos confirmados

| Item | Valor | Fonte |
| --- | --- | --- |
| Organização | `wjb assessoria contabil`, **Pro Plan**, 1 projeto, 1 membro (Owner: conta da Daniella) | painel > Organizations / Projects |
| Projeto de produção | `wjb-website-app` (ref `hlyukumgyzswfndlzwcf`), **pertence à organização Pro** - não precisa transferir | painel > Project Settings |
| Região | South America (São Paulo), `sa-east-1` | idem |
| Compute | **NANO** (painel oferece upgrade para MICRO marcado "Free Upgrade") | Settings > Infrastructure |
| Disco | 0,20 GB usados de 2 GB; expande sozinho até 8 GB com o Spend Cap ligado | idem |
| Branches | nenhuma; integração GitHub não configurada | Project Overview |
| Cobrança | Pro US$ 25,00 pago em 20/11 (fatura FBVAQX-00003); ciclo 20/11 a 20/12; custo projetado US$ 25,00; **Spend Cap ligado**; crédito US$ 0,00 | Org > Billing |
| Spend Cap | **não cobre**: compute, compute de branches, PITR, domínio próprio, IPv4 | docs oficiais "Cost control" |
| Branches | começam **sem dados** de produção; branches pelo painel usam o histórico de migrations do projeto; pelo GitHub usam as migrations do repositório + `supabase/config.toml` | docs oficiais "Branching" |
| Repositório | `main` = `a7d15d22` (F1, publicada); `wjb-ai/f2-solicitar-nfse` = `804f1f60`, 1 commit à frente, não publicada | `git` |

## 2. Situação do banco de produção no momento da auditoria
- Status **"Project is coming up"** (ligando) durante toda a auditoria.
- Últimas 24 h: 838 requisições, **1% de sucesso**, 816 erros de Postgres distribuídos de forma constante ao longo do dia.
- **Dedução (não confirmada):** o projeto estava pausado (já aconteceu em 29/09 e 10/11 no plano gratuito) e o site/agendamentos continuaram tentando acessar. A contratação do Pro coincide com o projeto voltando. Enquanto não terminar de subir, login do Portal/Admin e gravação de leads ficam indisponíveis (o site comercial segue no ar e cai no WhatsApp).
- Não abri os logs de consultas (podem conter dados pessoais). Se os erros continuarem depois de "Healthy", investigar com o proprietário.

## 3. Não confirmado (precisa do painel com o projeto ligado)
- Versão exata do Postgres ("Service versions" não carregou com o projeto subindo).
- Se o histórico de migrations do Supabase está vazio. **Dedução forte:** as migrations 0001 a 0023 foram aplicadas pelo SQL Editor, então o histórico deve estar vazio - o que inviabiliza branches pelo painel.

## 4. Opções de homologação e custo

Referência de preço exibida no próprio painel: **MICRO = US$ 0,01344/hora ≈ US$ 9,81/mês (730 h)**. Produção roda em NANO ao mesmo preço por hora, já absorvido no custo projetado de US$ 25.

| Opção | Custo adicional estimado | Isolamento | Esforço | Observação |
| --- | --- | --- | --- | --- |
| **A. Projeto separado `wjb-ai-homologacao`** (Micro, sa-east-1, mesma organização) | **≈ US$ 10/mês** enquanto existir; cobrança por hora; apagar o projeto encerra o custo | total (banco, Auth, chaves e URL próprios) | baixo | **Recomendada** |
| B. Branch persistente no projeto de produção | ≈ US$ 10/mês se ficar ligada | bom, mas a configuração fica dentro do projeto de produção | médio: exige integração GitHub e `supabase/config.toml` | branch pelo painel não serve (histórico de migrations vazio) |
| C. Branches de preview por PR | por hora só enquanto o PR existir | bom | alto (mesmos requisitos de B) | útil depois, para revisão de cada PR |

**Fora do Spend Cap:** o compute de A, B ou C é cobrado mesmo com o Spend Cap ligado. Não há add-ons pagos necessários (PITR, IPv4, domínio próprio ficam desligados na homologação).

**Valor final:** o painel mostra o custo exato antes de confirmar a criação; o número acima é estimativa a partir do preço por hora exibido.

## 5. Recomendação
1. **Criar `wjb-ai-homologacao`** (opção A), compute Micro, região São Paulo, só com dados fictícios. Apagar ao fim da homologação, se não for mais usado.
2. **Separado, decidir sobre produção (não executado):** o painel oferece subir produção de NANO para MICRO sem custo adicional no Pro (1 GB de memória). Exige reinício de alguns minutos; fazer fora do horário comercial e só com sua autorização.

## 6. Ambientes (Fase B)
| Ambiente | Onde roda | Banco | Regra |
| --- | --- | --- | --- |
| development | computador local | Postgres local (Docker) ou homologação | dados fictícios |
| staging | build de produção local (`next start`), não publicado | `wjb-ai-homologacao` | script de guarda recusa iniciar se a URL for a de produção (`hlyukumgyzswfndlzwcf`) |
| production | Hostinger | `wjb-website-app` | sem alterações nesta fase |

Segredos da homologação ficam em `.env.homolog.local` neste computador (já ignorado pelo Git via `.env*`), nunca no chat, no código ou em `NEXT_PUBLIC_*` de produção.

## 7. Ações do proprietário no painel (depois da aprovação do custo)
1. Organização `wjb assessoria contabil` > **New project**.
2. Nome `wjb-ai-homologacao`; região **South America (São Paulo)**; compute **Micro**.
3. Senha do banco: use "Generate a password" e guarde no gerenciador de senhas. **Não cole no chat.**
4. Confirme o valor no aviso de custo do painel.
5. Quando o projeto ficar "Healthy", crie neste computador o arquivo `.env.homolog.local` com: URL do projeto, chave publicável (anon), chave secreta (service role) e a string de conexão do banco (Settings > Database > Connection string, modo Session). Eu leio o arquivo só por script, sem exibir valores.
6. Authentication > URL Configuration: Site URL `http://localhost:3000`.

## 8. O que eu faço depois (Fase B e C), sem tocar em produção
Aplicar 0001 a 0024 na homologação pela string de conexão; criar usuários e empresas fictícios pela Admin API; rodar a bateria de RLS **pela aplicação** (Supabase Auth + PostgREST) e os E2E com login real de teste; backup/restauração e rollback; relatório com evidências.
