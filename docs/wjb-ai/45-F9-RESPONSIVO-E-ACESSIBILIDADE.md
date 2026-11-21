# 45 - Fase 9: revisão de responsividade e acessibilidade

**Data:** 21/11/2026. Build local de staging (Supabase de homologação, usuários fictícios). Reproduzir: `bash scripts/wjb-ai/qa/responsivo.sh`. Evidência: `docs/wjb-ai/evidencias/responsivo.json` (sem dados pessoais) e capturas em `docs/wjb-ai/evidencias/f9/`.

**Limite declarado:** tudo é **emulado no Chromium** (Playwright). **Não foram testados** Safari, Firefox, aparelhos reais, leitores de tela (VoiceOver e TalkBack) nem os links do WhatsApp nos aplicativos.

## 1. Cobertura
| Área | Rotas | Tamanhos | Medições |
| --- | --- | --- | --- |
| Site público, rotas críticas (inclui `/emissao-de-notas` e `/planos`) | 8 | 15 | 120 |
| Site público, demais rotas (inclui `/ajuda` e 404) | 21 | 4 | 84 |
| Primeira visita com banner de cookies, 320 px | 8 | 1 | 8 |
| Portal (inclui `/portal/plano`) | 10 | 15 | 150 |
| Admin (inclui `/admin/comercial` e `/admin/whatsapp`) | 8 | 15 | 120 |
| **Total** | | | **482** |

Tamanhos: 320, 360, 375, 390, 393, 414, 430 (celular em pé), 640x400 (tela de 1280 com **zoom de 200%**), 768, 820, 1024, 1280, 1440, 1920 e 844x390 (celular deitado). O 320x568 equivale a **zoom de 400%** numa tela de 1280.

## 2. Resultados
| Critério | Resultado |
| --- | --- |
| Rolagem horizontal da página | **0 de 482** |
| Viewport que bloqueia zoom | **0** (`viewport` com `viewportFit: cover`, sem `user-scalable=no` nem `maximum-scale=1`) |
| axe-core (WCAG 2.0, 2.1 e 2.2, níveis A e AA), falhas sérias ou críticas, 94 amostras em 390 e 1280 | **0** |
| Foco visível com teclado (15 Tabs por página, 94 amostras) | 91 sem aviso. Os 3 avisos foram conferidos à mão e são limitação do script, não defeito (seção 4) |
| Dani com a resposta comercial aberta | cabe na tela em 320x568 (topo 20 px, base 556 px), 390x844 e 844x390 |
| Item pendente da Fase 8 em `/ajuda` (contraste 4,15:1) | **resolvido**: 0 falhas no axe nos dois manuais |

## 3. Defeitos encontrados e corrigidos nesta fase (com antes e depois)
| Defeito | Correção | Capturas |
| --- | --- | --- |
| Prévia da fatura no Portal em 390 px: o valor do desconto descia para baixo do rótulo, e a linha mostrava o código interno (`nfse_mei`) no lugar do nome do plano | valor alinhado à direita, sem quebra (`shrink-0`, `whitespace-nowrap`, números tabulares); fatura com o nome do plano | `antes-fatura-portal-390.png`, `depois-fatura-portal-390.png` |
| Aviso "Você usou 80% da franquia" em laranja `#c38822`: contraste 3,06:1 (o mínimo é 4,5:1). O axe não pegou na primeira rodada porque o aviso só aparece com 80% de uso | `text-warning-text` (`#714f14`, 7,42:1). Com o aviso na tela, o axe dá 0 falhas | `antes-alerta-franquia-390.png`, `depois-alerta-franquia-390.png` |

Conferido de passagem: o vermelho de erro (`#b53042`) tem 6,06:1, e o azul de informação não é usado como texto.

## 4. Avisos do script de foco que não são defeito
- **Campos de data e mês** (`/portal/nfse/nova`, `/admin/logs`): ao receber foco pelo teclado, o campo ganha o anel azul de 2 px e a borda muda para `#194382`. Conferido medindo o estilo e numa captura (`foco-campo-competencia-390.png`). O script mede um instante antes de o Chrome aplicar o estilo nesses campos.
- **`/ajuda`**: depois do último elemento acessível, o Tab volta ao início, que é o comportamento esperado. Os 12 links do "Índice" ficam dentro de um bloco recolhido e não recebem foco até ele ser aberto. O script foi ajustado para não contar elementos dentro de blocos recolhidos.

## 5. Outras capturas (390 e 1280 px)
`emissao-de-notas`, `planos`, `portal_plano`, `admin_comercial`, `admin_whatsapp`, `ajuda` e `dani-comercial-390.png`.

## 6. Itens pedidos que não se aplicam
- Formulário de pagamento simulado: não existe, por decisão. Não há botão de pagamento nesta fase.
- Tabelas densas: a margem em `/admin/comercial` e a diferença de versões em `/admin/nfse/[id]` rolam dentro de uma região acessível pelo teclado (Fase 8). As listas de assinaturas e de filas são listas que quebram linha, sem rolagem lateral.

## 7. Recomendações para antes do lançamento
1. Teste em iPhone (Safari) e Android (Chrome), incluindo o teclado virtual sobre o pré-cadastro e a Dani.
2. Firefox e Safari no computador.
3. VoiceOver e TalkBack nos fluxos de pré-cadastro, Dani e contratação simulada.
4. Abrir cada link de WhatsApp no WhatsApp Web, no aplicativo de computador e nos dois celulares.
5. Aumentar a área de toque das caixas de seleção de 16 px. O rótulo já é clicável, então o risco é baixo.
