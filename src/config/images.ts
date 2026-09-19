/**
 * Estrutura de imagem compartilhada — WJB_Assets_Imagens_V1.md.
 * `src` é sempre o caminho gerado pelo manifesto; até a fotografia real
 * chegar, o arquivo é um placeholder gerado por `scripts/gen-placeholders.mjs`.
 */
export interface PageImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * Avatar do Assistente Virtual WJB (prompt mestre do assistente,
 * 2026-09-05) - foto real fornecida pela WJB no mesmo dia, aplicada por
 * `scripts/apply-assistant-avatar-photo.mjs` (o placeholder gerado por
 * `scripts/gen-assistant-avatar-placeholder.mjs` ficou sem uso, mas
 * permanece no repo como registro).
 */
export const assistantAvatar: PageImage = {
  src: "/images/wjb-assistant/avatar.webp",
  alt: "Retrato de sorriso da assistente virtual da WJB Assessoria Contábil",
  width: 200,
  height: 200,
};

export const digitalAccountingImages = {
  hero: {
    src: "/images/digital/digital-accounting-hero.webp",
    alt: "Profissional analisando indicadores contábeis em dois monitores e notebook",
    width: 1920,
    height: 1280,
  },
  documents: {
    src: "/images/digital/digital-documents.webp",
    alt: "Equipe revisando relatórios e documentos financeiros impressos durante reunião",
    width: 1600,
    height: 1067,
  },
  calendar: {
    src: "/images/digital/digital-calendar-obligations.webp",
    alt: "Dupla consultando um calendário de mesa e a agenda digital no notebook",
    width: 1600,
    height: 1067,
  },
  support: {
    src: "/images/digital/digital-human-support.webp",
    alt: "Consultora mostrando documento a um cliente durante atendimento, com notebook aberto na mesa",
    width: 1600,
    height: 1067,
  },
} satisfies Record<string, PageImage>;

export const armelxImages = {
  /** Foto trocada em 2026-09-14 (print de referência do usuário, foto "01.png" da mesma leva das 6 fotos de apoio já aplicadas). */
  hero: {
    src: "/images/armelx/wjb-armelx-hero.webp",
    alt: "Equipe da Armel-x analisando painel de operações inteligentes, fluxo de processos e resultados em telões",
    width: 1920,
    height: 1280,
  },
  /**
   * (2026-09-14, fotos reais novas fornecidas pelo usuário, print de
   * referência) — substituem as 3 fotos anteriores do mesmo slot. Mantidas
   * em 1600x1067 (3:2, mesma proporção da foto original enviada, sem
   * necessidade de corte de conteúdo).
   */
  automation: {
    src: "/images/armelx/automation-integrations.webp",
    alt: "Equipe da Armel-x em sala de reunião analisando painel de automação e integrações (Salesforce, HubSpot, AWS, Microsoft 365) em telão",
    width: 1600,
    height: 1067,
  },
  dashboards: {
    src: "/images/armelx/data-dashboards.webp",
    alt: "Equipe da Armel-x analisando dashboards de receita, conversão e desempenho por canal em múltiplos monitores",
    width: 1600,
    height: 1067,
  },
  cloud: {
    src: "/images/armelx/cloud-devops-software.webp",
    alt: "Equipe da Armel-x analisando arquitetura de nuvem, pipeline de deploy e observabilidade em telões",
    width: 1600,
    height: 1067,
  },
  /**
   * (2026-09-14, mesma leva de fotos, a pedido do usuário — "acrescentar as
   * outras 3 imagens abaixo seguindo o mesmo padrão") — 3 novos slots pra
   * expandir a grade de "Áreas de atuação" de /armel-x-tecnologia de 3 pra
   * 6 fotos de apoio.
   */
  softwareDevelopment: {
    src: "/images/armelx/software-development.webp",
    alt: "Equipe da Armel-x revisando código, arquitetura de sistema e roadmap de produto em múltiplos monitores",
    width: 1600,
    height: 1067,
  },
  mobileApps: {
    src: "/images/armelx/mobile-apps.webp",
    alt: "Equipe da Armel-x apresentando telas de um aplicativo mobile (onboarding, login, checkout) em telão",
    width: 1600,
    height: 1067,
  },
  uxProductDesign: {
    src: "/images/armelx/ux-product-design.webp",
    alt: "Equipe da Armel-x discutindo fluxo de usuário, wireframes e design system em telões",
    width: 1600,
    height: 1067,
  },
  /**
   * Foto real fornecida pelo usuário em 2026-08-31 ("Tecnologia_07.png"),
   * usada na seção "WJB + Armel-x Tecnologia" de /sobre — slot próprio (não
   * reaproveita `automation`) porque aquela imagem também aparece em
   * /armel-x-tecnologia e trocar o arquivo mudaria as duas páginas.
   */
  technologyTeam: {
    src: "/images/armelx/technology-team.webp",
    alt: "Equipe de tecnologia analisando dashboards, arquitetura de sistema e pipeline de deploy em telas",
    width: 1600,
    height: 1067,
  },
} satisfies Record<string, PageImage>;

/**
 * Fotografia ilustrativa (2026-08-30, fornecida pelo usuário) — não retrata
 * a equipe real da WJB. Alt text deliberadamente genérico ("profissionais em
 * reunião"), sem afirmar identidade, até que fotos reais da equipe existam
 * (ver docs/design/images.md, pendência de public/images/team/).
 */
export const aboutImage: PageImage = {
  src: "/images/about/wjb-purpose-people.webp",
  alt: "Profissionais em reunião de trabalho, analisando relatórios em equipe",
  width: 1800,
  height: 1200,
};

/**
 * Foto real fornecida pelo usuário em 2026-08-31 ("Imagen 02.png"), usada na
 * seção "Um escritório preparado para atender empresas..." de /sobre — slot
 * próprio (não reaproveita `homeImages.humanPlusTech`) porque aquela imagem
 * também aparece na Home (seção HumanPlusTech) e trocar o arquivo mudaria
 * as duas páginas.
 */
export const aboutOfficeImage: PageImage = {
  src: "/images/about/office-consulting.webp",
  alt: "Consultora e cliente revisando gráficos e relatórios com notebook na mesa",
  width: 1600,
  height: 1067,
};

/**
 * Foto real fornecida pelo usuário em 2026-09-06 ("Imagem atendimento.png",
 * largada na raiz do repo) — banner largo de /contato, consultor e cliente
 * em reunião com a marca WJB visível no vidro e na caneca ao fundo.
 * Aplicada por `scripts/apply-contact-page-image.mjs`.
 */
export const contactHeroImage: PageImage = {
  src: "/images/contato/contact-hero.webp",
  alt: "Consultor da WJB Assessoria Contábil em reunião com cliente, revisando relatórios",
  width: 1800,
  height: 947,
};

/**
 * Fotografia real da equipe (2026-08-30, fornecida pelo usuário) — retrato
 * de Daniella Santana, CEO, founder e contadora da WJB. Primeiro slot real
 * de `public/images/team/`, antes só documentado como pendência (ver
 * docs/design/images.md).
 */
export const teamImages = {
  /**
   * A pedido do usuário em 2026-08-31, voltou a ser placeholder (igual ao
   * do Diego) em vez da foto real já aplicada — a foto real continua em
   * `public/images/team/daniella-santana-portrait.webp`, só não é mais
   * referenciada aqui. Reverter é só trocar o `src` de volta.
   */
  daniellaSantana: {
    src: "/images/team/daniella-santana-portrait-placeholder.webp",
    alt: "Retrato de Daniella Santana, CEO e fundadora da WJB (foto pendente)",
    width: 1200,
    height: 1500,
  },
  /**
   * Diego Júlio de Barros, cofundador e diretor do Departamento Fiscal
   * (2026-08-31, a pedido do usuário) — ainda sem foto real, placeholder
   * gerado por `scripts/gen-diego-placeholder.mjs` até a WJB fornecer.
   */
  diegoJulioDeBarros: {
    src: "/images/team/diego-julio-de-barros-portrait.webp",
    alt: "Retrato de Diego Júlio de Barros, cofundador e diretor do Departamento Fiscal da WJB",
    width: 1200,
    height: 1500,
  },
} satisfies Record<string, PageImage>;

export const homeImages = {
  /**
   * Carrossel do Hero. Segunda leva (2026-09-14, mesmo dia) — usuário
   * forneceu 9 fotos numa pasta ("Carousel Website WJB", raiz do projeto)
   * pra substituir TODOS os slides anteriores (a foto "trocar a foto
   * atual" da leva anterior e a foto original do Hero), na ordem
   * explicitamente pedida: "Carousel 01.png" primeiro, "Fiscal e
   * Tributário.png" segundo, resto em ordem alfabética da pasta (não
   * especificada pelo usuário). Diferente de toda outra foto do site,
   * mantidas em **`.png`, formato e qualidade originais** (pedido
   * explícito) em vez do `.webp` padrão — arquivos bem mais pesados
   * (~3-5.8MB cada, vs ~90-380KB do `.webp` usado no resto do site).
   * As 2 fotos da leva anterior continuam em disco (não referenciadas),
   * mesmo padrão de preservar fotos reais já usado no projeto.
   *
   * **1254×1254 (quadrado)**, não 4:3 — corrigido no mesmo dia depois que
   * o usuário confirmou (print do Canvas Size do Photoshop) que os
   * originais eram quadrados. Os PNGs quadrados originais já tinham sido
   * apagados pelo script da leva anterior (limpeza da pasta de origem,
   * mesmo padrão de todo o projeto); o quadrado atual foi reconstruído a
   * partir dos arquivos já recortados em 4:3, não do original intocado —
   * ver docs/design/images.md pra detalhe completo dessa ressalva.
   */
  heroSlides: [
    {
      src: "/images/home/home-hero-carousel-01.png",
      alt: "Consultora da WJB apresentando gráficos a um cliente, com painel 'Diagnóstico que gera decisões melhores' exibido em tela ao fundo",
      width: 1254,
      height: 1254,
    },
    {
      src: "/images/home/home-hero-carousel-02.png",
      alt: "Consultor e cliente da WJB revisando apuração de impostos, com a frase 'Conformidade hoje. Mais oportunidades amanhã.' na parede de vidro",
      width: 1254,
      height: 1254,
    },
    {
      src: "/images/home/home-hero-carousel-03.png",
      alt: "Consultor da WJB mostrando um checklist de certidão a uma cliente, com pastas de certidões e regularização na mesa",
      width: 1254,
      height: 1254,
    },
    {
      src: "/images/home/home-hero-carousel-04.png",
      alt: "Consultor e cliente da WJB revisando documentos, com a frase 'Contabilidade para cada novo ciclo.' na parede de vidro",
      width: 1254,
      height: 1254,
    },
    {
      src: "/images/home/home-hero-carousel-05.png",
      alt: "Consultora da WJB apresentando a estrutura societária de uma empresa a um cliente, com a frase 'Empresas mais sólidas para um amanhã maior.' na parede",
      width: 1254,
      height: 1254,
    },
    {
      src: "/images/home/home-hero-carousel-06.png",
      alt: "Consultora e cliente da WJB revisando planejamento e resultados, com livros de contabilidade, fiscal, departamento pessoal e consultoria empresarial na mesa",
      width: 1254,
      height: 1254,
    },
    {
      src: "/images/home/home-hero-carousel-07.png",
      alt: "Consultor da WJB apresentando a folha de pagamento a uma cliente, com livros sobre admissão, férias e rescisão na mesa",
      width: 1254,
      height: 1254,
    },
    {
      src: "/images/home/home-hero-carousel-08.png",
      alt: "Consultor e cliente da WJB revisando cenários fiscais e planejamento tributário, com laptops e livros sobre estratégia fiscal na mesa",
      width: 1254,
      height: 1254,
    },
    {
      src: "/images/home/home-hero-carousel-09.png",
      alt: "Consultora da WJB e cliente assinando o documento de constituição de empresa, com livros sobre abertura e registro empresarial na mesa",
      width: 1254,
      height: 1254,
    },
  ],
  businessNeeds: {
    src: "/images/home/home-business-needs.webp",
    alt: "Equipe reunida ao redor de um notebook analisando relatórios e gráficos",
    width: 1600,
    height: 1067,
  },
  digitalAccounting: {
    src: "/images/home/home-digital-accounting-platform.webp",
    alt: "Consultora e cliente analisando notebook com painel de indicadores em sobreposição digital",
    width: 1800,
    height: 1200,
  },
  humanPlusTech: {
    src: "/images/home/home-human-plus-technology.webp",
    alt: "Dupla analisando indicadores em monitor e notebook durante reunião",
    width: 1800,
    height: 1200,
  },
  taxReform: {
    src: "/images/home/home-tax-reform.webp",
    alt: "Dupla analisando notebook com painel de indicadores em sobreposição digital",
    width: 1600,
    height: 1067,
  },
  wjbArmelx: {
    src: "/images/home/home-wjb-armelx-business-technology.webp",
    alt: "Equipe reunida ao redor de um notebook, com bandeira do Brasil ao fundo",
    width: 1800,
    height: 1200,
  },
  finalCta: {
    src: "/images/home/home-final-consultation-cta.webp",
    alt: "Equipe reunida ao redor de um notebook e um telão com indicadores",
    width: 1600,
    height: 900,
  },
} satisfies Record<string, PageImage | PageImage[]>;

/**
 * Espaço vazio do mega menu "Serviços" (2026-08-31, a pedido do usuário com
 * print de referência) — grid de 3 colunas com só 5 categorias deixa a
 * última célula (linha 2, coluna 3) vaga. Foto real fornecida no mesmo dia
 * (substituiu o placeholder gerado por `scripts/gen-services-menu-promo.mjs`).
 */
export const servicesMenuPromoImage: PageImage = {
  src: "/images/services/services-menu-promo.webp",
  alt: "Consultor apresentando gráficos e indicadores para uma cliente durante reunião",
  width: 480,
  height: 600,
};

/** WJB_Assets_Imagens_V1.md, seção 12 — 1200×630, só para páginas reais. */
export function getServiceOgImage(slug: string): string {
  return `/images/og/servico-${slug}.webp`;
}

export function getBlogOgImage(slug: string): string {
  return `/images/og/blog-${slug}.webp`;
}
