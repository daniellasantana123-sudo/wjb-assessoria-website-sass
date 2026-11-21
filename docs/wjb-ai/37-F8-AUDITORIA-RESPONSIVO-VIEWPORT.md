# 37 - Fase 8: auditoria de responsivo, viewport e acessibilidade

**Data:** 21/11/2026. Rodado contra um build local de staging (Supabase de homologação, usuários fictícios).
**Importante:** todos os tamanhos de tela são **emulados no Chromium** (Playwright). Nenhum aparelho real foi usado, e Firefox e Safari (WebKit) **não foram testados**: os navegadores não estão instalados aqui e o download não foi feito de propósito.

Para reproduzir: `bash scripts/wjb-ai/qa/responsivo.sh`. O resultado completo está em `docs/wjb-ai/evidencias/responsivo.json`, sem dados pessoais: só rotas, tamanhos de tela e contagens.

## 1. Cobertura
| Área | Rotas | Tamanhos de tela | Medições |
| --- | --- | --- | --- |
| Site público, rotas críticas (Home, Planos, Emissão de notas, Contato, um serviço, um post, Login, Área do cliente) | 8 | 14 | 112 |
| Site público, demais rotas (inclui `/ajuda` e a página 404) | 21 | 4 | 84 |
| Primeira visita (banner de cookies aberto), 320 px | 8 | 1 | 8 |
| Portal (login de cliente fictício) | 10 | 14 | 140 |
| Admin (login de super admin fictício) | 8 | 14 | 112 |
| **Total** | | | **456** |

Os 14 tamanhos: 320x568, 360x800, 375x667, 390x844, 393x852, 414x896, 430x932, 768x1024, 820x1180, 1024x768, 1280x800, 1440x900, 1920x1080 e 844x390 (celular deitado). Os 4 tamanhos da amostra rápida: 320, 390, 768 e 1280.

## 2. Resultados
| Critério | Resultado |
| --- | --- |
| Rolagem horizontal da página (estouro) | **0 de 456** |
| Viewport bloqueando zoom (`user-scalable=no` ou `maximum-scale=1`) | **0** |
| Status HTTP | 452 respostas 200; 4 respostas 404 esperadas (`/pagina-que-nao-existe`) |
| axe-core, falhas sérias ou críticas (WCAG 2.0, 2.1 e 2.2, níveis A e AA), 94 amostras em 390 px e 1280 px | **antes:** contraste e região rolável sem foco em várias rotas. **Depois:** 1 elemento em `/ajuda` (12 px, contraste 4,15:1), corrigido e conferido por axe nos dois manuais gerados |

O axe roda com `prefers-reduced-motion: reduce`. Sem isso, o contraste era medido no meio da animação de entrada (texto ainda transparente), o que gerava alertas falsos.

## 3. Correções feitas (detalhe no doc 34, seção 3)
- Verde de sucesso usado como texto pequeno trocado pelo tom escuro (`text-success-text`).
- Cores do manual `/ajuda` (laranja `#a84800`, cinza `#59636f`).
- 5 tabelas com rolagem horizontal acessíveis pelo teclado.

## 4. Alvos de toque menores que 24x24 px: análise
A contagem aparece em quase todas as linhas, mas a maior parte não é falha:
| Alvo | Ocorrências | Avaliação |
| --- | --- | --- |
| "Pular para o conteúdo" | 452 | fica escondido fora da tela até receber foco; o script mede assim mesmo. Não é falha |
| Breadcrumb "Home" e marca "Portal"/"Admin WJB" da barra lateral | ~335 | links de texto com espaço livre em volta: valem pela exceção de espaçamento do critério 2.5.8 |
| Caixas de seleção (16 px) | 83 | o rótulo ao lado também é clicável. Recomendo aumentar a área de toque numa fase futura |
| Botões "Serviços", "Soluções" e "Empresa" do cabeçalho | 44 cada | aparecem só a partir de 1280 px (computador, com mouse), com espaço entre eles |
| `summary "Editar"` em `/admin/comercial` | 24 | recomendação de baixo custo: aumentar o espaçamento interno |

Nenhum desses itens foi alterado nesta fase: são componentes existentes, sem falha comprovada e com impacto pequeno.

## 5. O que falta (não substitui o teste humano)
1. Teste em aparelhos reais: iPhone com Safari e Android com Chrome, incluindo o teclado virtual sobre os formulários do Portal.
2. Firefox e Safari no computador.
3. Leitor de tela (VoiceOver e TalkBack) nos fluxos de contratação e de pedido de nota.
