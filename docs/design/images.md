# Imagens

> Fonte de verdade: `WJB_Assets_Imagens_V1.md` (fornecido pelo usuário em 2026-08-30, fora do repositório). Este documento resume como o manifesto foi implementado em código.

## Status

**Todos os slots de conteúdo do manifesto têm fotografia real (2026-08-30), incluindo agora o primeiro retrato real da equipe em `/sobre` e a imagem do mega menu "Serviços" (ambos 2026-08-31) — só retratos de outros colaboradores da equipe (quantidade/nomes ainda não definidos pela WJB) continuam pendentes. (Nota: uma versão anterior desta linha dizia `home-business-needs` ainda pendente — estava desatualizada, essa imagem já foi conectada na "Terceira leva" abaixo.) O usuário forneceu 40 fotos reais no total, em duas levas (`public/images/Imagen 01-19.png` na primeira, `public/Imagen 01-10.png`+`19-29.png` na segunda — números reaproveitados, conteúdo diferente), sem indicar qual vai em qual slot — Claude inspecionou o conteúdo de cada uma e escolheu o slot mais coerente por assunto (ver tabelas abaixo). A segunda leva incluía capturas de tela com texto em português específico do domínio da WJB (painéis de "Folha de pagamento", "Visão fiscal" com DAS/IRRF/FGTS/ISS, "Documentos"/"Obrigações"/"Fluxos de trabalho", calendário de obrigações), o que tornou o destino de várias delas bem mais óbvio.

## Estrutura de pastas

Exatamente como a seção 4 do manifesto: `public/images/{home,services,digital,armelx,about,team,og}` + `public/images/blog/{accounting,tax,reform,business,payroll,technology}`.

## Como os placeholders foram gerados

`scripts/gen-placeholders.mjs` — usa `sharp` (já é dependência do Next.js, nenhuma lib nova) para rasterizar um SVG simples nas dimensões exatas de cada slot do manifesto. Rodar de novo (`node scripts/gen-placeholders.mjs`) sempre que um novo slot de imagem for adicionado antes da foto real existir.

## Onde cada imagem foi conectada

- **Home**: `src/config/images.ts` (`homeImages`) — Hero (`hero.tsx`, com `priority`, é o LCP), NeedsPicker (seção 5.2 — inicialmente não conectada, ver "Terceira leva" abaixo sobre a mudança de decisão), DigitalAccountingPreview, HumanPlusTech, TaxReform, WjbArmelx (layout de duas colunas, texto + imagem, alternando o lado), CtaFinal (imagem de fundo com overlay `bg-primary/85`, `alt=""` por ser puramente decorativa).
- **Serviços**: `service-pages.ts` ganhou o campo `image` — as 11 páginas têm hero em duas colunas (`servicos/[slug]/page.tsx`).
- **Contabilidade Digital / Armel-x**: hero + galeria de 3 imagens de apoio com legenda curta (`src/config/images.ts` — `digitalAccountingImages`, `armelxImages`).
- **Sobre**: uma imagem (`aboutImage`), com nota de que deve ser substituída pela foto real da equipe (seção 9.1 do manifesto).
- **Blog**: os 15 artigos do manifesto `WJB_Blog_Conteudos_V1.md` (implementados em 2026-08-30) têm imagem (`posts.ts`, campo `image`). `PostCard` usa a imagem como thumbnail 16:9.
- **Open Graph**: `getServiceOgImage(slug)` / `getBlogOgImage(slug)` em `images.ts`, conectados no `generateMetadata` de cada rota dinâmica; Home, Contabilidade Digital e Armel-x têm OG fixo.

## Fotos reais aplicadas em 2026-08-30

`scripts/apply-real-photos.mjs` (uso único, usa `sharp`, sem lib nova) converteu as 19 fotos (`Imagen 01.png`…`19.png`) para o caminho e dimensões exatos de cada slot (`fit: "cover"`, `position: sharp.strategy.attention` para não cortar rostos), depois removeu os PNGs originais soltos em `public/images/`. Mapeamento:

| Foto | Slot |
|---|---|
| Imagen 01 | Home — hero |
| Imagen 02 | Armel-x — hero |
| Imagen 03 | Serviço — Consultoria |
| Imagen 04 | Contabilidade Digital — hero |
| Imagen 05 | Home — WJB + Armel-x |
| Imagen 06 | Armel-x — dashboards |
| Imagen 07 | Armel-x — automação |
| Imagen 08 | Armel-x — cloud/infra |
| Imagen 09 | Contabilidade Digital — documentos |
| Imagen 10 | Contabilidade Digital — atendimento humano |
| Imagen 11 | Serviço — Certidões e Regularização |
| Imagen 12 | Home — Contabilidade Digital |
| Imagen 13 | Contabilidade Digital — calendário |
| Imagen 14 | Sobre |
| Imagen 15 | Serviço — Fiscal e Tributário |
| Imagen 16 | Home — Reforma Tributária |
| Imagen 17 | Home — CTA final |
| Imagen 18 | Serviço — Planejamento Tributário |
| Imagen 19 | Home — Humano + Tecnologia |

## Segunda leva de fotos reais (2026-08-30, mesmo dia)

`scripts/apply-real-photos-2.mjs` (uso único, mesmo padrão do script acima) converteu mais 21 fotos (`public/Imagen 01-10.png` + `19-29.png`, soltas direto em `public/`, não em `public/images/`) — cobrindo os 7 serviços que ainda faltavam e 12 dos 15 posts do blog. Mapeamento:

| Foto | Slot |
|---|---|
| Imagen 07 | Serviço — Abrir Empresa |
| Imagen 08 | Serviço — Trocar de Contador |
| Imagen 25 | Serviço — Contabilidade Completa |
| Imagen 04 | Serviço — Departamento Pessoal |
| Imagen 03 | Serviço — Reforma Tributária |
| Imagen 21 | Serviço — Recuperação Tributária |
| Imagen 28 | Serviço — Legalização e Societário |
| Imagen 29 | Blog — Gestão de Prazos e Obrigações |
| Imagen 19 | Blog — Contabilidade Digital |
| Imagen 20 | Blog — Automação de Processos |
| Imagen 06 | Blog — Dashboards e Dados na Gestão |
| Imagen 01 | Blog — Planejamento Tributário |
| Imagen 02 | Blog — Como Evitar Pagar Impostos a Mais |
| Imagen 09 | Blog — Lucro Presumido |
| Imagen 26 | Blog — Como Abrir uma Empresa |
| Imagen 24 | Blog — Como Trocar de Contador |
| Imagen 10 | Blog — Regularização Fiscal |
| Imagen 22 | Blog — Balanço e DRE |
| Imagen 23 | Blog — Inteligência Artificial nos Negócios |

Imagen 05 e Imagen 27 (desta segunda leva) não tinham slot claro — composição redundante com outras fotos já usadas — e foram descartadas junto com os originais convertidos, sem virar arquivo extra em `public/`.

Os `alt` de todos os slots afetados (nas duas levas) foram reescritos para descrever o que a foto real mostra (WCAG — não faz sentido manter o texto do placeholder). As OG images de todos os slots acima também foram recortadas (1200×630) a partir das mesmas fotos, pra consistência entre o preview de link e a página real.

**Sobre a imagem de "Sobre"**: é fotografia ilustrativa (pessoas genéricas), não a equipe real da WJB — o `alt` foi escrito de forma deliberadamente genérica ("Profissionais em reunião de trabalho"), sem afirmar que são a equipe da WJB, até que existam fotos reais da equipe (autorizadas, ver Pendências).

Com as duas levas, **as 11 páginas de serviço e os 15 posts do blog têm fotografia real**.

## Terceira leva — fotos da Home (2026-08-30, mesmo dia)

Usuário forneceu mais 7 fotos direto em `public/` (`Imagen 01-07.png`), desta vez avisando explicitamente que eram "as imagens da Home". As 7 fotos compartilham um tratamento visual único — bastante espaço negativo à esquerda, sujeito(s) à direita — desenhado sob medida para o layout de duas colunas (texto à esquerda, imagem à direita) que a Home já usa. `scripts/apply-real-photos-3.mjs` (uso único) **substituiu as 6 imagens da Home das levas anteriores** e, pela primeira vez, **conectou `home-business-needs`** — revertendo a decisão original de deixá-la sem imagem, já que o usuário forneceu uma foto sob medida especificamente para ela e pediu explicitamente pelo conjunto completo das 7. Mapeamento:

| Foto | Slot |
|---|---|
| Imagen 01 | Home — hero (aperto de mãos) |
| Imagen 04 | Home — Escolha o que você precisa (NeedsPicker) |
| Imagen 02 | Home — Contabilidade Digital |
| Imagen 07 | Home — Humano + Tecnologia |
| Imagen 06 | Home — Reforma Tributária |
| Imagen 03 | Home — WJB + Armel-x (com bandeira do Brasil ao fundo) |
| Imagen 05 | Home — CTA final |

Como o `NeedsPicker` (`src/components/sections/needs-picker.tsx`) nunca teve imagem antes, sua estrutura mudou: virou o mesmo layout de duas colunas (imagem + `SectionHeading`) usado nas outras seções da Home, com o grid de 4 cards agora abaixo, ocupando a largura toda — em vez de só o heading centralizado seguido do grid.

`og/home.webp` foi regenerado a partir do novo hero.

## Quarta leva — fotos feitas sob medida para Open Graph (2026-08-30, mesmo dia)

Usuário forneceu mais 10 fotos direto em `public/` (`Imagen 01-10.png`, 1731×909 — praticamente a mesma proporção ~1.9:1 das OG images, 1200×630), avisando explicitamente que eram "para a seção OG". Diferente das levas anteriores (fotos de conteúdo de página, das quais a OG era só um recorte automático), essas já vêm compostas para o formato widescreen de preview de link — tom visual próprio (overlay laranja/dourado de ícones tech: calendário, nuvem, cofrinho, mapa-múndi), sem precisar do `object-position`/crop de página. `scripts/apply-real-photos-og.mjs` (uso único) substituiu 10 das OG images antes derivadas por recorte automático das fotos de conteúdo:

| Foto | OG substituída |
|---|---|
| Imagen 01 (cofrinho, ícones de %/segurança) | `servico-planejamento-tributario.webp` |
| Imagen 02 (ícones de pessoas/equipe) | `servico-departamento-pessoal.webp` |
| Imagen 03 (parede de dashboards + mapa-múndi) | `blog-dashboards-dados-gestao.webp` |
| Imagen 04 (assinatura de documento) | `servico-abrir-empresa.webp` |
| Imagen 05 (troca de papéis entre duas pessoas) | `servico-trocar-de-contador.webp` |
| Imagen 06 (dupla revisando dashboard) | `servico-consultoria-contabil.webp` |
| Imagen 07 (equipe + ícones de fluxo/documento) | `servico-contabilidade-completa.webp` |
| Imagen 08 (ícone de nuvem) | `contabilidade-digital.webp` |
| Imagen 09 (calendário + checklist + sino) | `blog-gestao-prazos-obrigacoes.webp` |
| Imagen 10 (equipe + mapa-múndi/dados) | `armelx.webp` |

As outras 19 OG images (Home permanece com o crop do hero atual, e os 18 slots restantes de serviço/blog) continuam sendo recortes automáticos das fotos de conteúdo — não vieram fotos específicas de OG pra eles ainda.

## Regras seguidas (seção 14 do manifesto)

- `next/image` em todo lugar, com `width`/`height` (ou `fill` + wrapper com `aspect-*`), `alt` e `sizes` explícitos.
- `priority` só nos heros que são LCP real (Home, cada página de serviço, Contabilidade Digital, Armel-x, Sobre, cada post de blog) — nunca em thumbnails de lista (`PostCard`) ou imagens abaixo da dobra.
- Imagem puramente decorativa (`CtaFinal`) usa `alt=""`.
- Nenhuma imagem foi cortada de forma a cortar rosto/elemento essencial (não há fotos reais ainda para essa preocupação valer, mas os `object-position`/crops estão prontos para receber).

## Correção de imagens do blog (2026-08-30, mesmo dia)

Usuário reportou "imagens repetidas" no blog. Investigando, encontrei dois problemas reais:

1. **3 posts nunca tinham recebido foto real** (Reforma Tributária, Simples Nacional, Departamento Pessoal) — ficaram com o placeholder gerado por engano desde a primeira leva (documentação anterior dizia "15/15 têm foto real", o que estava errado). Corrigidos reaproveitando a foto real já usada na página de serviço do mesmo assunto: `services/tax-reform.webp`, `services/tax-accounting.webp`, `services/payroll-hr.webp`.
2. **Os 3 posts de Tecnologia** (Automação, Dashboards, IA) usavam fotos da mesma sessão de fotos, com composição quase idêntica (reunião + tela de fundo) — visualmente repetitivas lado a lado. Corrigidos reaproveitando as fotos da Armel-x (`armelx/automation-integrations.webp`, `armelx/data-dashboards.webp`, `armelx/wjb-armelx-hero.webp`), tematicamente coerentes com os 3 assuntos.

`scripts/fix-blog-images.mjs` (uso único) fez os recortes 1600×900. OG das 5 páginas afetadas (exceto `dashboards-dados-gestao`, que já tinha foto dedicada de OG) foram regeneradas.

## Fotos dos depoimentos (2026-08-31)

Usuário forneceu 8 fotos de perfil geradas por IA direto em `public/` (`Imagen 01-08.png`, "anexei as imagens na pasta publica"), acompanhando `WJB_Depoimentos_Carrossel_Fotos_Footer_Claude_FINAL.md`. O documento descrevia a ordem de geração como "4 mulheres, depois 4 homens", mas ao abrir cada arquivo a ordem real ficou intercalada (`Imagen 01` mulher, `02-05` homens, `06-08` mulheres) — mapeei por ordem de gênero dentro de cada grupo, na sequência exata do documento (1ª mulher → Mariana Costa, 2ª → Juliana Rocha, 3ª → Patrícia Alves, 4ª → Fernanda Ribeiro; 1º homem → Rafael Mendes, 2º → Carlos Henrique Lima, 3º → André Martins, 4º → Lucas Ferreira). `scripts/apply-testimonial-photos.mjs` recortou cada uma pra 400×400 (`fit:"cover"` + `sharp.strategy.attention`) e salvou em `public/images/testimonials/[nome]-[sobrenome].png` — nomenclatura exata pedida pelo documento, mantendo `.png` em vez do `.webp` padrão do resto do site (instrução explícita de não alterar os nomes). Continuam depoimentos **fictícios/ilustrativos** (mesmo aviso discreto da leva anterior) — as fotos são só para dar rosto ao layout, não fotos de clientes reais da WJB.

## Banner de /contato (2026-09-06)

Usuário largou `Imagem atendimento.png` na raiz do repo (1734×907, consultor e cliente em reunião, marca WJB visível no vidro e na caneca ao fundo) e pediu para usar como banner largo em `/contato`, com a página redesenhada (arquitetura visual + responsividade). `scripts/apply-contact-page-image.mjs` redimensionou para 1800px de largura e converteu para webp, salvo em `public/images/contato/contact-hero.webp` (novo slot `contactHeroImage` em `src/config/images.ts`) — PNG solto da raiz removido depois de aplicado. `/contato` ganhou banner full-width (`aspect-[1800/942]`, `rounded-[8px]`) entre o texto de intro e a seção de contato/formulário, e o bloco de informações de contato virou um card (`bg-muted/30`, `rounded-[8px]`) com ícone por item (`lucide-react`: Mail, MessageCircle, MapPin, FileText) em vez da lista `dl` simples anterior — mesmo padrão de cantos de 8px usado no mapa embutido (commit anterior).

**Atualização (2026-09-07):** usuário substituiu a fonte por `Atendimento.png` (raiz do repo, mesma cena, 1729×910) - mesmo local/pessoas, mas com o logo novo (traço arredondado + acento laranja) na parede de vidro e na caneca, em vez do cursivo antigo. `scripts/apply-contact-page-image.mjs` atualizado para essa fonte, mesmo destino (`contact-hero.webp`, sobrescrito). Proporção real ficou 1800×947 (era 1800×942) - `aspect-[1800/942]` em `/contato` e `height` em `contactHeroImage` ajustados para bater exato.

## Pendências

- [x] Foto real de Daniella Santana (2026-08-31, usuário largou 2 fotos direto em `public/`, "para você usar", sem indicar destino): `Imagen 01.png` (retrato solo, roupa social, escritório com vidro ao fundo) reconhecida como a foto da equipe pendente. `scripts/apply-real-photos-team-promo.mjs` recortou para 1200×1500 (4:5) e salvou em `public/images/team/daniella-santana-portrait.webp` — **primeiro (e por ora único) retrato real de `public/images/team/`**. Conectada em `/sobre` (seção "Especialistas...", ao lado do nome/CRC, substituindo o texto "aguardando fotos oficiais"). **Atualização 2026-08-31, mais tarde no mesmo dia**: usuário pediu pra voltar a ser placeholder (igual ao do Diego Júlio de Barros, adicionado no mesmo dia) — a foto real continua em disco (`daniella-santana-portrait.webp`), só não é mais referenciada; `teamImages.daniellaSantana` em `src/config/images.ts` aponta agora pro placeholder `daniella-santana-portrait-placeholder.webp` (gerado por `scripts/gen-daniella-placeholder.mjs`). Reverter é só trocar o `src` de volta.
- [x] Foto real para `services/services-menu-promo.webp` (mesma leva, 2026-08-31): `Imagem 02.png` (consultor + cliente revisando gráficos/documentos numa mesa, com notebook) combinava exatamente com a descrição já escrita para esse slot — recortada para 480×600 pelo mesmo script, substituindo o placeholder gerado por `scripts/gen-services-menu-promo.mjs` no dia anterior.
- [ ] Foto real de Diego Júlio de Barros (2026-08-31, cofundador e diretor do Departamento Fiscal — nome/cargo fornecidos pelo usuário) — placeholder gerado por `scripts/gen-diego-placeholder.mjs` em `public/images/team/diego-julio-de-barros-portrait.webp` (1200×1500, mesmo padrão 4:5 do retrato da Daniella), conectado em `/sobre` (grid "Nossa equipe" com 2 pessoas). Substituir quando a WJB fornecer.
- [ ] Fotos reais de outros colaboradores da equipe além de Daniella e Diego (`public/images/team/`, nomenclatura `[nome]-[sobrenome]-portrait.webp`), com autorização de uso de imagem — quantidade/nomes ainda não definidos pela WJB. Ver modelo em `public/Test/team-membro-exemplo-portrait.png`.
- [ ] Validar CLS/LCP com Lighthouse agora que todos os slots de conteúdo têm peso de arquivo real (~20-140KB cada, vs poucos KB do placeholder) — o peso final pode mudar os números.

## Segunda leva de fotos da Home, com o logo novo (2026-09-07)

Usuário largou 01.png-07.png na raiz do repo, sem indicar destino, atualizando as 7 fotos da Home aplicadas em 2026-08-30 - mesmo estilo (pessoas em reunião, negative space à esquerda), agora com o logo redesenhado (traço arredondado + acento laranja) visível em algumas cenas (05, todas mostram a marca em canecas/telas). Mapeamento por assunto em `scripts/apply-home-photos-v2.mjs` - ver commit para a lista completa. `home-hero-wjb-consultive-accounting.webp` (05.png, aperto de mãos com o logo na parede) foi indicada explicitamente pelo usuário para o hero.

## Segunda leva de fotos de serviços (2026-09-14, mesmo dia)

Usuário largou 10 fotos na raiz do projeto, cada uma já nomeada pelo título exato da página de serviço correspondente (`Abrir Empresa.png`, `Trocar de Contador.png`, `Contabilidade Completa.png`, `Fiscal e Tributário.png`, `Departamento Pessoal.png`, `Planejamento Tributário.png`, `Reforma Tributária.png`, `Certidões e Regularização.png`, `Consultoria.png`, `Legalização e Societário.png` - 1731×909 cada), cobrindo as 10 páginas de serviço restantes (a 11ª, Recuperação Tributária, já tinha sido trocada horas antes, ver seção seguinte). Mapeamento 1:1 sem ambiguidade (nome do arquivo == `title` exato em `service-pages.ts`). `scripts/apply-service-photos-2026-09-14.mjs` (uso único) recortou cada uma para o slot de hero (`services/*.webp`, 1600×1067, `fit:"cover"` + `sharp.strategy.attention`) e regenerou a OG image correspondente (`og/servico-<slug>.webp`, 1200×630) a partir da mesma foto - mesmo padrão de `apply-tax-recovery-photo.mjs`. `alt` de cada uma das 10 reescrito em `service-pages.ts` para descrever a cena real (mesma linha visual das fotos anteriores: escritório da WJB, logo na parede, consultora/cliente, telas com painéis/checklists genéricos como "Situação Fiscal", "Certidão Negativa de Débitos", "Reforma Tributária" - sem nenhum valor financeiro específico inventado, diferente da foto de Recuperação Tributária). Os 10 PNGs originais foram removidos da raiz após a conversão.

**Limpeza de imagens não utilizadas** (mesmo pedido do usuário): varredura completa de `public/images/` contra todas as referências em `src/` - nenhum arquivo órfão encontrado. As únicas correspondências "sem match direto de nome" eram os arquivos de OG gerados por template (`getServiceOgImage`/`getBlogOgImage`, `og/servico-*.webp` e `og/blog-*.webp`), conferidos manualmente 1:1 contra os slugs reais de `service-pages.ts`/`posts.ts` - todos em uso. Nenhuma imagem antiga sobrou para remover, porque a troca desta leva (e da leva de Recuperação Tributária) sobrescreveu os arquivos nos mesmos caminhos já existentes, em vez de criar novos.

## Foto de /servicos/recuperacao-tributaria trocada (2026-09-14)

Usuário largou `Recuperação Tributária.png` (1536×1024) na raiz do repo pedindo pra trocar a foto da página de serviço "Recuperação Tributária" por ela. **Alerta sinalizado antes de aplicar**: a foto mostra um monitor com um mockup de dashboard com valores em R$ legíveis ("R$ 285.430 Créditos identificados", "R$ 178.920 Em recuperação", "R$ 106.510 Recuperados", "+38% Potencial de economia") ao lado da logo da WJB na parede — risco de leitura como resultado real de cliente, o que esbarra na regra de nunca inventar dados. Usuário optou por aplicar mesmo assim. `scripts/apply-tax-recovery-photo.mjs` (uso único) recortou para `services/tax-recovery.webp` (1600×1067) e regenerou `og/servico-recuperacao-tributaria.webp` (1200×630) a partir da mesma foto; `alt` em `service-pages.ts` reescrito para descrever a cena real (sem citar os valores da tela). PNG original removido da raiz após a conversão.

## Foto do Hero da Home trocada de novo (2026-09-14, mesmo dia)

Usuário largou `Hero.png` (1536×1024) na raiz do repo pedindo pra trocar a foto do Hero da Home (`homeImages.hero`), com instrução explícita de manter "qualidade normal" — ou seja, sem nenhum tratamento especial de compressão, só o padrão já usado em toda foto real do site (`sharp`, `fit:"cover"` + `sharp.strategy.attention`, `quality: 82`). Cena é outro aperto de mãos entre consultora e cliente no escritório da WJB (logo na parede), tematicamente idêntica à foto anterior — `alt` em `images.ts` não precisou mudar. `scripts/apply-hero-photo-2026-09-14.mjs` (uso único) recortou para 1920×1280, sobrescrevendo `home/home-hero-wjb-consultive-accounting.webp` (90KB, peso normal pra esse slot). PNG original removido da raiz após a conversão.

## Logo com espaço transparente assimétrico corrigido (2026-09-14, mesmo dia)

Usuário reportou o logo do footer "não alinhado à esquerda". Investigando, o problema não era CSS (o wrapper já usava `self-start`, sem stretch) — era o **arquivo**: `public/brand/logos/logo-wjb-color.png` e `logo-wjb-white.png` (ambos 3368-3369×1772) tinham 505px de espaço transparente à esquerda contra só 324px à direita (164px simétrico em cima/embaixo), medido via `sharp().trim()`. Como o espaço extra faz parte do arquivo, nenhum alinhamento CSS resolvia sozinho — o logo sempre ficaria visualmente deslocado pra direita dentro da própria caixa da imagem. `scripts/trim-logo-padding-2026-09-14.mjs` (uso único) recortou os dois arquivos para o bounding box real do conteúdo visível (2540×1444, simétrico), sobrescrevendo-os no mesmo caminho. `width`/`height` do `<Image>` em `navigation/logo.tsx` (241×137) e `layout/site-footer.tsx` (164×93) ajustados pra nova proporção (2540/1444 ≈ 1.759, era ≈1.9) — sem isso o `next/image` distorceria o logo com `w-auto` calculando a proporção errada.

## Hero da Home virou carrossel (2026-09-14, mesmo dia)

Usuário pediu pra transformar a foto única do Hero num carrossel (`npm dlx shadcn@latest add carousel`) e forneceu uma nova foto (`Atendimento WJB 02.png`, raiz do projeto, 1254×1254) pra "trocar a foto atual". `homeImages.hero` (uma imagem) virou `homeImages.heroSlides` (array de 2): a foto nova entra como primeiro slide (visível por padrão, "substituindo" a atual), e a foto que já estava lá (aperto de mãos) virou o segundo slide em vez de descartada. `scripts/apply-hero-carousel-photo-2026-09-14.mjs` (uso único) recortou a foto nova pra 1920×1440 (mesma proporção de exibição 4:3 do slide existente, `fit:"cover"` + `sharp.strategy.attention`) em **qualidade 95** (não o 82 padrão do resto do site — pedido explícito do usuário, "qualidade automática/original", pra essa imagem específica acima da dobra). A foto em si tem o texto "Números que impulsionam seu futuro" impresso na parede de vidro do escritório (parte do cenário fotografado, não copy inventado pelo site) — mantive como está no `alt`, sem tratar como dado a validar (não é uma métrica/resultado específico, ao contrário do caso de `Recuperação Tributária.png`).

**Pegadinha operacional séria** ao rodar `npx shadcn@latest add carousel` — ver seção "O incidente do `shadcn add carousel`" logo abaixo.

## Todos os slides do carrossel do Hero trocados (2026-09-14, mesmo dia, leva seguinte)

Usuário forneceu uma pasta inteira (`Carousel Website WJB/`, raiz do projeto) com 9 fotos e pediu pra **remover todas as fotos do carrossel** (as 2 da leva anterior) e usar essas 9 no lugar, com ordem explícita pros 2 primeiros slides ("Carousel 01.png" primeiro, "Fiscal e Tributário.png" segundo) e livre pro resto (usei ordem alfabética da pasta: Abrir Empresa, Carousel 05-08, Planejamento Tributário, Reforma Tributária). `homeImages.heroSlides` passou de 2 pra 9 entradas.

**Diferença importante desta leva**: pedido explícito de **"formato original e qualidade original"** — ao contrário de toda outra imagem do site (sempre convertida pra `.webp`), essas 9 ficaram em **`.png`**, com `sharp().png()` (lossless por natureza, sem parâmetro de compressão perdida) em vez de `.webp({quality})`. `scripts/apply-hero-carousel-full-set-2026-09-14.mjs` (uso único) ainda recortou cada uma de 1254×1254 (quadrada) pra 1920×1440 via `fit:"cover"` + `sharp.strategy.attention` (mesma proporção 4:3 de exibição do carrossel) — o recorte em si não perde qualidade (PNG lossless independe do tamanho), só reduz a área visível com inteligência de conteúdo em vez de deixar por conta do `object-cover` puro do CSS.

**Achado técnico que quase anulou o pedido**: mesmo salvando como `.png`, o otimizador de imagens do Next.js recomprimiria pra `.webp` automaticamente na hora de servir (mesmo comportamento da tarefa "aumente a resolução", ver acima) — silenciosamente desfazendo o "formato original". Corrigido adicionando a prop `unoptimized` no `<Image>` do carrossel em `hero.tsx`, confirmado via `curl` que o arquivo é servido direto em `/images/home/...png` (não via `/_next/image?...`), `Content-Type: image/png`, mesmo `Content-Length` do arquivo em disco.

**Custo assumido conscientemente**: cada slide fica ~5.5-5.8MB (vs ~90-380KB de um `.webp` equivalente no resto do site) — pesado pra uma seção acima da dobra, mas é a consequência direta e esperada do pedido explícito de qualidade/formato original, não um bug. `unoptimized` também significa nenhum `srcset` responsivo automático (mesmo arquivo de 1920×1440 baixado em qualquer tela, mobile incluído). As 2 fotos da leva anterior (`home-hero-atendimento.webp`, `home-hero-wjb-consultive-accounting.webp`) continuam em disco, não referenciadas — mesmo padrão de preservar fotos reais já usado no projeto.

### O incidente do `shadcn add carousel`

Rodar `npx shadcn@latest add carousel --dry-run -y` com `yes |` pra evitar prompt interativo **não preveniu escrita real de arquivos** — o CLI precisou rodar `init` primeiro (projeto não tinha `components.json`), e essa etapa de inicialização escreveu de verdade antes da flag `--dry-run` (que só se aplica à etapa final de "add") entrar em ação: sobrescreveu `src/components/ui/button.tsx` inteiro com um sistema incompatível (Base UI + `class-variance-authority` + variáveis OKLCH), injetou um bloco `.dark`/`@layer base` e uma segunda definição de `--background`/`--primary`/etc. em `globals.css` (colidindo com a "Paleta Vívida" já estabelecida, mesmos nomes de variável), reescreveu `src/lib/utils.ts` e `src/app/layout.tsx` (fonte Geist, import de `cn` de um pacote novo), e adicionou 5 dependências não pedidas (`@base-ui/react`, `class-variance-authority`, `cn`, `shadcn`, `tw-animate-css`) junto com a desejada `embla-carousel-react`. Revertido manualmente arquivo por arquivo (impossível usar `git checkout` cego em `button.tsx`/`globals.css` porque ambos tinham edições legítimas desta mesma sessão não commitadas — tiveram que ser reconstruídos à mão, não restaurados do HEAD). `src/components/ui/carousel.tsx` foi reescrito do zero contra `cn()` deste projeto (não o pacote `cn` do shadcn), com textos em PT-BR, setas quadradas com `rounded-[4px]` (pedido explícito, não o `rounded-full` padrão do shadcn) e usando `useSyncExternalStore` em vez do `useState`+`useEffect` original do shadcn pra sincronizar `canScrollPrev`/`canScrollNext` (o código original do shadcn reprovava o lint `react-hooks/set-state-in-effect` já estabelecido no projeto).

### Correção final: recuperação dos originais de verdade (2026-09-14, mesmo dia)

O script da seção anterior apagou a pasta `Carousel Website WJB/` depois de converter (mesmo padrão de toda foto do projeto) — só que essa leva precisava ficar em proporção quadrada nativa (1254×1254), e eu só percebi depois de já ter recortado tudo pra 4:3 e apagado a origem. Corrigi errado na hora (reconstruí o quadrado a partir do arquivo já recortado em 4:3, perdendo parte do enquadramento original - ex.: a logo da WJB cortada na lateral). Usuário reanexou a pasta original e eu recomecei do zero: `scripts/apply-hero-carousel-true-square-2026-09-14.mjs` copia os 9 PNGs **bit-a-bit** (`fs.copyFile`, sem `sharp`, sem redimensionar/recortar) pros mesmos 9 caminhos, na mesma ordem já configurada (`Carousel 01` → `Fiscal e Tributário` → resto em ordem alfabética). Conferido via `md5` que os arquivos em `public/images/home/` são idênticos byte a byte aos da pasta de origem.

**Desta vez a pasta `Carousel Website WJB/` NÃO foi apagada** - fica na raiz do projeto como cópia de segurança, caso precise reprocessar de novo.

## 8 fotos de posts do blog atualizadas com as fotos de serviço de hoje (2026-09-14, mesmo dia)

Usuário pediu pra "ler todas as fotos dos artigos e atualizar com as fotos novas que foram anexadas hoje", sem anexar nada novo dessa vez — entendi como reaproveitar as 10 fotos de serviço já renovadas hoje (ver "Segunda leva de fotos de serviços" acima), mesmo padrão já usado no projeto de compartilhar foto entre página de serviço e post do blog do mesmo assunto.

Mapeei os 15 posts contra as 10 fotos de serviço e só atualizei os **8 com correspondência de tema direta e clara** (evita repetir o erro documentado em "Correção de imagens do blog" - forçar foto sem sentido no post):

| Post | Foto de serviço reaproveitada |
|---|---|
| `reforma-tributaria-como-preparar-empresa` | `tax-reform.webp` |
| `planejamento-tributario-para-empresas` | `tax-planning.webp` |
| `como-evitar-pagar-impostos-a-mais` | `tax-accounting.webp` |
| `como-abrir-empresa` | `open-company.webp` |
| `como-trocar-de-contador` | `change-accountant.webp` |
| `regularizacao-fiscal-empresa` | `compliance-regularization.webp` |
| `balanco-dre-decisoes` | `full-accounting.webp` |
| `departamento-pessoal-folha` | `payroll-hr.webp` |

`scripts/update-blog-images-from-todays-photos-2026-09-14.mjs` (uso único) recortou cada foto de serviço (1600×1067) pra 1600×900 (16:9, padrão de capa do blog) via `fit:"cover"` + `sharp.strategy.attention`, sobrescrevendo o arquivo já existente de cada post (mesmo caminho, sem mudar `posts.ts` além do `alt`) e regenerando a OG image correspondente. `alt` de cada um dos 8 reescrito pra descrever a cena real (mesmo texto usado na página de serviço equivalente).

**7 posts ficaram sem correspondência de hoje, deliberadamente não tocados**: `simples-nacional-guia-empresas`, `lucro-presumido-como-funciona`, `contabilidade-digital`, `gestao-prazos-obrigacoes`, `automacao-processos-empresariais`, `dashboards-dados-gestao`, `inteligencia-artificial-negocios` — as 10 fotos de hoje são todas do eixo fiscal/societário/DP/contabilidade/consultoria, sem nenhuma foto de tecnologia/Simples Nacional/Lucro Presumido pra reaproveitar sem forçar. Se o usuário tiver fotos específicas pra esses, é só anexar.

## Os 7 posts restantes completados (2026-09-14, mesmo dia)

Usuário anexou 7 fotos genéricas (`01.png`..`07.png`, raiz do projeto, sem nome descritivo) pedindo pra usar "conforme anexados" nos 7 posts que tinham ficado sem correspondência. Como os nomes não indicavam o post, conferi o **conteúdo de cada uma** antes de aplicar (mesma diligência de toda foto do projeto) — a ordem 01→07 bateu exatamente com a ordem dos 7 posts listada no resumo anterior (cada foto mostra literalmente o assunto do post: documento escrito "Simples Nacional"/"Lucro Presumido", painel de Contabilidade Digital, calendário com checklist de prazos, workflow de automação, dashboards financeiros, ícone de IA), então apliquei nessa ordem sem precisar perguntar de novo.

`scripts/update-remaining-blog-images-2026-09-14.mjs` (uso único) processou as 7 no mesmo padrão de sempre (1600×900 pra capa, 1200×630 pra OG, `fit:"cover"` + `sharp.strategy.attention`, `quality: 82` — sem pedido de "qualidade original" desta vez, então voltou ao padrão do site). `alt` de cada um reescrito. Os 7 PNGs originais foram removidos da raiz após a conversão (sem pedido de preservar desta vez).

**Nota de conteúdo**: a foto de `dashboards-dados-gestao` mostra números específicos em tela (ex.: "R$ 286.430" de lucro líquido, "+12,5%", "32%" de margem) — diferente do caso de `Recuperação Tributária.png` (onde os números pareciam um resultado real de cliente), aqui é claramente um mockup genérico de dashboard financeiro ilustrando o assunto do próprio post (que é sobre dashboards), não uma alegação de resultado da WJB — não tratei como risco de dado inventado.

**Com isso, os 15 posts do blog têm foto real e temática desde 2026-09-14.**

## As 8 fotos reaproveitadas de serviço substituídas por fotos dedicadas (2026-09-14, mesmo dia)

Usuário anexou mais 8 fotos genéricas (`01.png`..`08.png`, raiz do projeto) acompanhadas de um print listando os 8 títulos de post na ordem correspondente ("Reforma Tributária", "Planejamento Tributário", "Como evitar pagar impostos a mais", "Como abrir uma empresa", "Como trocar de contador", "Regularização fiscal", "Balanço e DRE", "Departamento Pessoal / folha") — exatamente os 8 posts que horas antes tinham recebido fotos *reaproveitadas* das páginas de serviço (ver seção acima). Pediu pra trocar essas 8 pelas novas, "mantendo qualidade normal" (ou seja, o padrão do site - `quality: 82`, sem o tratamento especial usado no carrossel do Hero).

Conferido visualmente que cada uma das 8 fotos mostra literalmente o assunto do post (tela/documento com o nome exato escrito - "Reforma Tributária", "Planejamento Tributário", "Troca de Contador", "Regularização Fiscal", "Balanço Patrimonial"/"Demonstração do Resultado", "Folha de Pagamento", checklist de abertura de empresa) — ordem 01→08 bateu com a ordem do print, sem precisar perguntar de novo. `scripts/update-blog-dedicated-photos-2026-09-14.mjs` (uso único) sobrescreveu os mesmos 8 caminhos de arquivo já usados (1600×900 capa, 1200×630 OG, mesmo padrão de sempre). `alt` de cada um reescrito pra descrever a nova cena. Os 8 PNGs originais foram removidos da raiz após a conversão.

**Nota de conteúdo**: a foto de `balanco-dre-decisoes` mostra uma Demonstração do Resultado com valores específicos (Receita Bruta R$ 2.356.890, Lucro Líquido R$ 386.130, "+28,4%") e a de `como-evitar-pagar-impostos-a-mais` mostra "Economia Estimada -28%" — mesma análise de sempre: são mockups ilustrativos de relatório financeiro genérico (nomes/valores de exemplo, sem atribuição a um cliente real da WJB), consistentes com o resto da série de fotos desta leva, não uma alegação de resultado real.

## Fotos da Armel-x Tecnologia atualizadas (2026-09-14, mesmo dia)

Usuário anexou 7 fotos novas na raiz do projeto (`001.png`..`006.png` e depois `01.png`), todas da mesma leva visual (tema escuro, iluminação laranja, telões com dashboards/fluxos da marca Armel-x) — bem diferente do estilo claro das fotos anteriores de `/armel-x-tecnologia`.

- **3 das 6 fotos de apoio trocadas** (print de referência indicando quais): `automation-integrations.webp`, `data-dashboards.webp`, `cloud-devops-software.webp` — as próprias fotos já traziam o título certo escrito na tela ("Automação e Integrações", "Dados que impulsionam decisões", "Cloud, DevOps e software"), confirmando o mapeamento 1:1 com os slots existentes.
- **3 fotos de apoio novas acrescentadas** (pedido explícito de "seguir o mesmo padrão"): `software-development.webp`, `mobile-apps.webp`, `ux-product-design.webp` — grid de `/armel-x-tecnologia` foi de 3 pra 6 fotos (`sm:grid-cols-3` já rende 2 linhas de 3 sozinho, sem mudança de CSS).
- **Foto de destaque do topo trocada** (`wjb-armelx-hero.webp`, foto `01.png`, pedido separado logo em seguida): mesma linha visual das outras 6.

Todas processadas em 1600×1067 (fotos de apoio) / 1920×1280 (hero) via `sharp`, `fit:"cover"` + `sharp.strategy.attention`, `quality: 82` (padrão do site). `alt` de cada uma reescrito pra descrever a cena real. PNGs soltos da raiz apagados após o processamento.

**Pegadinha operacional confirmada de novo** (mesma classe do incidente de `services-menu-promo` documentado acima): depois de sobrescrever um arquivo `.webp` já publicado mantendo o mesmo nome, o cache de otimização de imagens do Next.js (`.next/cache/images`, também com uma camada em memória no processo do `next dev`) continuou servindo a versão antiga pela mesma URL. Resolvido apagando `.next/cache/images` **e** reiniciando o processo do `next dev` (o cache em memória sobrevive só a apagar a pasta em disco). Confirmado sempre via `curl`/`fetch` direto no endpoint, nunca só por screenshot de uma URL já visitada antes na mesma sessão do navegador de automação.
