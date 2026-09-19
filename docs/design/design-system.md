# Design System

> Status: **completo para a V1**. Cores, tipografia, grid, espaçamento, breakpoints, iconografia e motion formalizados abaixo (2026-08-30) — todos já em uso consistente no código, não são recomendações teóricas.

Conforme a seção 6 de [`../../Wjb-Website.md`](../../Wjb-Website.md), o Design System é a fonte de verdade para cores, tipografia, espaçamentos, grid, breakpoints, iconografia, componentes, estados, motion e acessibilidade.

## Regras já definidas no documento mestre, válidas desde já

- Border radius padrão: `6px` (botões, cards, inputs, selects, textareas, dropdowns, dialogs, modais, containers interativos). Pills somente em badges, tags, chips, filtros compactos e status (seção 7).
- Não criar um Design System paralelo sem necessidade (seção 6).
- Se um componente ainda não existir: usar tokens existentes, seguir os padrões visuais do sistema, documentar e tornar reutilizável.

---

## Cores — "Paleta Vívida"

> Fonte: artifact fornecido pelo usuário em 2026-08-30 (`claude.ai/code/artifact/2f410f47-e061-4c1b-8727-2e697e28bb28`). Azul como cor primária de marca, lilás e verde como cores de apoio, neutros levemente frios, e 4 cores semânticas mapeadas a estados de conciliação financeira. Contrastes calculados via WCAG 2.1 (relative luminance).

### Azul — primária e única cor de destaque

> Rampa regenerada em 2026-09-14, **terceira vez no mesmo dia**. Histórico do dia: `#2362A9` (original) → `#194382` (1ª correção) → `#003F93` (2ª correção, pixel exato do logo) → `#194382` de novo (decisão final — usuário voltou a este valor como "azul oficial da WJB" e, desta vez, também **removeu o laranja do site inteiro**, unificando toda a interface num só destaque de cor). `600` é `#194382` bit-a-bit — trate como o valor estável a partir daqui, salvo pedido explícito em contrário. Os demais steps foram recalculados no mesmo matiz/saturação (~216°, ~68%) pra manter a progressão de claro a escuro coerente. Contraste `600` vs. branco: **9.69:1**.

Uso: navegação principal, cabeçalhos, botões de ação primária (incluindo CTAs — ver nota abaixo), links, ícones, badges, indicadores, bordas de destaque — toda a interface usa só esta cor como acento, com branco/cinza/neutros como suporte.

| Step | Hex |
|---|---|
| 50 | `#ECF2FB` |
| 100 | `#D4E2F7` |
| 200 | `#A9C5EF` |
| 300 | `#76A2E5` |
| 400 | `#3E7DDA` |
| 500 | `#225DB4` |
| 600 | `#194382` |
| 700 | `#133362` |
| 800 | `#0E2447` |
| 900 | `#08162B` |

### Lilás — apoio

Uso: destaques secundários, tags, elementos decorativos, seções que precisam se diferenciar do azul.

| Step | Hex |
|---|---|
| 50 | `#F4F1F9` |
| 100 | `#E7DFF1` |
| 200 | `#CFBFE3` |
| 300 | `#B197D3` |
| 400 | `#9470C2` |
| 500 | `#764BAF` |
| 600 | `#613D8F` |
| 700 | `#4D3172` |
| 800 | `#3A2556` |
| 900 | `#241736` |

### Verde — apoio

Uso: segunda cor de apoio — gráficos, ícones, elementos que pedem contraste de temperatura em relação ao azul e ao lilás.

| Step | Hex |
|---|---|
| 50 | `#F1F9F5` |
| 100 | `#DFF1E8` |
| 200 | `#BFE3D1` |
| 300 | `#97D3B5` |
| 400 | `#70C299` |
| 500 | `#4BAF7D` |
| 600 | `#3D8F66` |
| 700 | `#317252` |
| 800 | `#25563D` |
| 900 | `#173626` |

### Laranja — removido (histórico)

O site teve uma variante de paleta com laranja de marca (`#FF6D00`) como cor de destaque/conversão, usada em 2026-09-14 por algumas horas. **O laranja foi removido de vez no mesmo dia** — usuário decidiu usar só o azul oficial (`#194382`) como cor de destaque em toda a interface, reaproveitando o azul exatamente nos lugares onde o laranja tinha sido aplicado (botões, CTAs, hovers, ícones, badges, links, indicadores, bordas, detalhes gráficos).

A rampa `brand-orange` foi removida de `globals.css`. Os tokens `--color-cta`/`--color-cta-foreground`/`--color-cta-text` continuam existindo (evita reescrever os ~16 arquivos que já usam `variant="cta"`/`text-cta-text`), mas agora resolvem pro azul (`var(--color-primary)`) — visualmente idênticos a `primary`, mantidos só como nome semântico.

**Se o laranja for reintroduzido no futuro**, o valor de referência exato é `#FF6D00` (amostrado por pixel de `public/brand/logos/logo-wjb-color.png`) — mas atenção ao contraste: `#FF6D00` com texto branco só bate 2.82:1 (reprova WCAG AA); a solução usada da última vez foi texto escuro (`--color-neutral-900`) sobre o laranja puro, ou um tom escurecido (`#A34600`, step 700 de uma rampa H≈26°/S=100%) com texto branco.

### Neutros — papel e tinta

Uso: fundos, texto corrido, bordas e divisores. Levemente frios para combinar com o azul primário.

| Step | Hex |
|---|---|
| 50 | `#F7F7F8` |
| 100 | `#ECEDEF` |
| 200 | `#D8DBDF` |
| 300 | `#BCC1C7` |
| 400 | `#98A0A9` |
| 500 | `#747F8B` |
| 600 | `#5D656F` |
| 700 | `#464C53` |
| 800 | `#2E3338` |
| 900 | `#1A1C1F` |

### Semânticas — status

Cores funcionais independentes das cores de marca, mapeadas a estados reais (ex.: conciliação, obrigações, prazos).

| Status | Base | Fundo | Texto sobre fundo |
|---|---|---|---|
| Pago / sucesso | `#43A36B` | `#E6F5EC` | `#265E3E` |
| Pendente / aviso | `#C38822` | `#FAF0E1` | `#714F14` |
| Vencido / erro | `#B53042` | `#F8E3E6` | `#691C26` |
| Em análise / info | `#348CB2` | `#E3F1F7` | `#1E5167` |

### Uso recomendado (base de marca)

- Azul primário de ação e única cor de destaque da interface (oficial): `#194382` (step 600).
- Lilás de apoio: `#6F46A4`.
- Verde de apoio: `#347957`.
- Fundo neutro padrão (claro): `#F7F7F8`.
- Texto sobre fundo neutro: `#25292C`.

### Fundo

`body` (`globals.css`) tem um gradiente radial azul leve nos 4 cantos da viewport (2026-08-30, a pedido do usuário) — `rgba(35, 98, 169, 0.08-0.1)`, `background-attachment: fixed` (ancorado à tela, não ao documento, então os 4 cantos ficam visíveis em qualquer altura de scroll). Só aparece atrás de seções sem cor de fundo própria.

### Modo escuro

Tema padrão do site: **light** (confirmado pelo usuário em 2026-08-30). Dark mode não é prioridade da V1.

**[CONFIRMAR]** — se/quando um modo escuro for implementado, a paleta acima ainda não tem uma variante escura definida. Não inverter os steps por conta própria; decidir a estratégia (ramps invertidos vs. tokens dedicados) apenas se e quando for priorizado.

---

## Tipografia

> Fonte: par "Corporate Trust" recomendado pela skill `ui-ux-pro-max` para o estilo "Trust & Authority" (financeiro/consultoria/serviços profissionais), aplicado em 2026-09-19 a pedido do usuário — redesign visual mantendo os mesmos componentes. Substitui a Inter única usada até então (indicada pelo usuário em 2026-08-30).

- **Títulos (h1-h6): Lexend** — aplicada globalmente via seletor de elemento em `globals.css` (`h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading) }`), não por classe em cada componente. Desenhada para legibilidade/acessibilidade, alinhada à regra de WCAG 2.2 AA do projeto.
- **Corpo de texto: Source Sans 3** — token `--font-sans`, usada em `body` (herdada por todo o resto: parágrafos, labels, botões, formulários).
- Fallback stack: `"Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (títulos) / `"Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (corpo).
- Pesos recomendados a carregar: 400 (regular), 500 (medium), 600 (semibold), 700 (bold) — mesma faixa de antes, ambas via `next/font/google` (self-host, sem layout shift).
- **Exceção**: o H1 do Hero continua em **Noto Sans Thai** (`font-noto-sans-thai`, decisão separada e anterior do usuário, 2026-09-17) — não foi alterado por este redesign, vence a regra global de heading pela cascata normal do CSS (classe mais específica que seletor de elemento).
- Fonte monoespaçada: **[CONFIRMAR]** — não definida pelo usuário. Usar stack padrão do sistema (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`) até definição, caso necessário (ex.: valores tabulares, código).
- Travessão (`—`): não usar em texto visível do site (2026-08-30, a pedido do usuário) — usar hífen normal (`-`) em qualquer conteúdo novo (JSX, strings, `alt`/`aria-label`). Vale só para conteúdo renderizado; comentários de código continuam livres para usar `—`.
- **Títulos grandes (H1 de página e H2 de seção, classe `text-3xl`/`text-4xl`/`text-2xl` combinada com `tracking-tight`) usam `font-bold` (700)**, não `font-semibold` (2026-08-31, a pedido do usuário — antes eram `font-semibold`). Vale para todo H1/H2 de destaque, incluindo `SectionHeading` (`src/components/sections/section-heading.tsx`), `Hero`, `CtaFinal`, `PlanDetails` e os títulos de cada página. Subtítulos menores (`text-lg`/`text-xl` `font-semibold`, ex.: títulos de card, "O que inclui") continuam `font-semibold` — a regra é só para os títulos grandes.

---

## Grid e Container

Um único componente `Container` (`src/components/layout/container.tsx`) define a grade horizontal de toda a V1: `max-w-6xl` (1152px) centralizado, com padding responsivo `px-4` (mobile) → `sm:px-6` → `lg:px-8`. Toda seção/página usa esse componente — não recriar larguras máximas ad-hoc.

Exceções deliberadas: o mega menu (`src/components/navigation/mega-menu.tsx`) usa largura própria (`w-[640px] max-w-[90vw]`) por ser um painel flutuante, não uma seção de página.

## Header e Logo

Header com `h-20` (80px) e logo em `h-14` (56px) — aumentado em 2026-08-30 a pedido do usuário para dar mais presença de marca (era `h-16`/`h-9`). O nav desktop agrupa a maioria das páginas em 3 itens de topo (`Serviços`, `Soluções`, `Empresa`, todos com submenu) + `Planos`/`Contato`/`Área do Cliente` soltos, em vez de 7+ links flat — reduz a sensação de poluição visual sem remover nenhuma página. Ver `src/config/navigation.ts`.

## Breakpoints

Os breakpoints padrão do Tailwind v4, usados consistentemente:

| Prefixo | Largura | Uso típico no projeto |
|---|---|---|
| (nenhum) | 0px | Mobile first — base de todo componente |
| `sm:` | 640px | Grids de 2 colunas (cards, formulários) |
| `lg:` | 1024px | Grids de 3–4 colunas |
| `xl:` | 1280px | Corte desktop/mobile do header e do menu (ver Claude.md — `lg` quebrava o layout dos CTAs) |

Testado manualmente em 320/375/390/430/768/1024/1280/1440/1920px ao longo das FASES 2–7 (seção 10).

## Espaçamento

Escala padrão do Tailwind (`4px` por unidade), sem tokens customizados. Convenções observadas no código:

- Padding vertical de seção: `py-16 sm:py-20` (Home) ou `py-12 sm:py-16` (páginas internas).
- Padding interno de card: `p-5`.
- Gap entre itens de grid de cards: `gap-4`.
- Gap entre blocos de conteúdo dentro de uma seção: `gap-6` a `gap-10`.
- Espaço vertical entre elementos de formulário: `gap-5` (linhas) / `gap-2` (label + input).

## Iconografia

**Lucide Icons** (`lucide-react`, seção 21). Convenções:

- Tamanho: `h-4 w-4` (inline com texto pequeno), `h-5 w-5` (padrão em botões/accordions), `h-6 w-6` (header/menu mobile), `h-7 w-7` (WhatsApp flutuante).
- Todo ícone decorativo leva `aria-hidden="true"` (nunca é o único indicador de uma ação — sempre acompanhado de texto ou `aria-label` no elemento pai).
- Ícones em uso: `Menu`, `X` (menu mobile), `ChevronDown` (accordions, mega menu), `ChevronRight` (breadcrumb), `ArrowRight` (cards de necessidade), `Check` (listas "o que inclui"), `MessageCircle` (WhatsApp), `Users`, `SlidersHorizontal`, `Cpu`, `ShieldCheck` (Trust Bar).

## Motion

Adicionado na FASE 7 (2026-08-30), a pedido do usuário. Princípios:

- **Hover em cards**: `transition-all duration-200 hover:-translate-y-1 hover:shadow-md` — aplicado em todo card clicável (serviços, necessidades, posts, soluções).
- **Revelação ao rolar**: `RevealOnScroll` (`src/components/shared/reveal-on-scroll.tsx`) — fade-in-up via IntersectionObserver nas seções da Home abaixo do Hero. Protegido por `<noscript>` no layout raiz para nunca esconder conteúdo de quem não roda JS (seção 9).
- **Accordions** (FAQ, submenu "Área do Cliente" do menu mobile): técnica `grid-rows-[0fr]→[1fr]` com `inert` no painel fechado — anima abertura/fechamento sem JS de medição de altura, e remove o conteúdo fechado do foco/leitura de tela sem desmontá-lo.
- **Entrada de elementos condicionais** (menu mobile, mega menu, banner de cookies): `@starting-style` (CSS puro, classes `.animate-enter` / `.animate-slide-up` em `globals.css`) — preferir a `useEffect` + `setState`, que o lint `react-hooks/set-state-in-effect` rejeita para esse padrão.
- Tudo respeita `prefers-reduced-motion: reduce` (regra global já existente em `globals.css`, seção 9).

## Imagens

Ver [`images.md`](./images.md) — manifesto completo de imagens (`WJB_Assets_Imagens_V1.md`) implementado em código (`next/image`, dimensões, alt, sizes, OG) com placeholders visuais até a fotografia real chegar.

## Pendências

- [ ] Confirmar pesos de Inter realmente usados e otimizar carregamento (`next/font`), se o payload de fontes virar um problema de performance real.
- [ ] Fotografia real das imagens do site (ver `images.md`) — única pendência de conteúdo visual para a V1.
