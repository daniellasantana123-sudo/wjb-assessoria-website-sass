# SEO e performance - WJB Assessoria Contábil

Fase 5 do plano comercial. Distingue o que foi implementado, o que foi medido e o que depende da WJB.

## 1. SEO técnico (já implementado em rodadas anteriores)

| Item | Situação |
| --- | --- |
| `title` e `meta description` únicos | Implementado. Posts usam `seoTitle` (até 60 caracteres); serviços aceitam `seoDescription`. |
| `canonical` | Implementado em todas as páginas públicas (`alternates.canonical`). Nunca no layout. |
| `www.` duplicado | Redireciona 308 para o domínio sem www. |
| Endereços do WordPress antigo | `/home` e `/quem-somos` com 308; o resto (`/wp-*`, feeds) responde 410 em `src/proxy.ts`. |
| Sitemap e robots.txt | `src/app/sitemap.ts` e `robots.ts`; só rotas reais; `lastModified` só quando a data é real. |
| Dados estruturados | `AccountingService` (com horário), `Service` por página de serviço, `Article`, `BreadcrumbList`. Sem `FAQPage` (o Google restringiu o rich result) e sem avaliações. |
| Open Graph | JPEG 1200x630 (WebP some no WhatsApp); posts geram a imagem no build. |
| Headings | Um H1 por página (corrigido em `/duvidas`). |

## 2. Performance mobile (2026-11-10)

### Medição

Lighthouse 12, perfil mobile, contra build de produção local (`next start`). O site publicado não pode ser medido daqui: o CDN da Hostinger responde 403 a navegadores automatizados.

| Cenário | Antes | Depois |
| --- | --- | --- |
| Peso total da Home | 1.192 KB | 977 KB |
| Fontes pré-carregadas | 6 (~210 KB) | 3 (~100 KB) |
| Fotos do carrossel baixadas antes do `load` | 5 (~530 KB) | 1 (~100 KB) |
| LCP, limitação aplicada (`--throttling-method=devtools`) | - | 2,0 a 2,1 s (meta: 2,5 s) |
| LCP, limitação simulada (padrão do PageSpeed) | 6,1 a 6,3 s | 3,7 a 5,1 s |
| CLS | 0 | 0 |

A limitação simulada (modelo "lantern") atribui ao LCP todo o JavaScript executado antes dele e costuma ser bem mais pessimista que a aplicada. O número que conta para o Google é o de campo (CrUX, aba "Descubra o que seus usuários reais estão vivenciando" no PageSpeed), que só aparece com tráfego suficiente.

### O que foi feito

1. **Fontes só com o subset `latin`** (`src/app/layout.tsx`). Ele cobre todo o português; o `latin-ext` não acrescentava nenhum caractere usado no site (conferido por busca no conteúdo) e dobrava as fontes de prioridade alta.
2. **Fotos 2 a 9 do carrossel só depois do `load`** (`useDeferredSlides` em `src/components/sections/hero.tsx`). O efeito fade empilha os slides, então `loading="lazy"` não segurava nada. As fotos entram 1,5 s após o `load` ou na hora em que a pessoa toca/arrasta/clica na seta.

### Testado e descartado

- **Lexend sem pré-carregamento**: LCP de 2,1 para 2,0 s, mas trouxe CLS de 0,056. Revertido.
- **Desligar `experimental.inlineCss`**: o CSS (63 KB) aparece duas vezes no HTML (na `<style>` e no payload RSC), mas comprimido o HTML tem 68 KB e desligar volta dois pedidos de CSS que bloqueiam a renderização. Mantido.

### Pendências

- **TBT de 500 a 900 ms**: quase todo vem da hidratação do React (`chunks/3794`, ~1,2 s de script com CPU 4x mais lenta). Reduzir exige transformar partes da Home em Server Components ou carregar componentes interativos sob demanda. Não feito: é uma refatoração maior, a decidir com a WJB.
- **Proteção anti-robô do CDN da Hostinger**: já derrubou o teste do PageSpeed ao bloquear um arquivo JS. Depende da WJB desligar a proteção ou o CDN.
