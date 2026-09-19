import type { Regime } from "@/types/pricing";

export interface PlanIncludedService {
  title: string;
  description: string;
}

export interface Plan {
  id: Regime;
  name: string;
  slug: string;
  startingPrice: number;
  detailsPath: string;
  simulatorPath: string;
  cardSummary: string;
  cardHighlights: string[];
  detail: {
    eyebrow: string;
    heroTitle: string;
    heroText: string;
    heroCta: string;
    whatIsTitle: string;
    whatIsText: string[];
    clientResponsibilities: string[];
    wjbServices: PlanIncludedService[];
    finalCta: string;
  };
}

/**
 * Planos mensais da WJB (WJB_Planos_Simulador_Implementacao_Claude.md,
 * seções 5, 7, 8 e 9). `startingPrice` de cada plano (2026-09-05, atualizado
 * a partir de `Tabela_de_Precos_WJB_Simulador_SP_2026_Preenchida.xlsx`, aba
 * Planos_Base, coluna "Valor efetivo") — substitui os preços de benchmark
 * inicial usados antes da matriz comercial oficial ser aprovada pela WJB.
 * Etapas "Como funciona com a WJB" são as mesmas para os três planos
 * (seções 7/8/9), por isso ficam centralizadas em `planHowItWorksSteps` em
 * vez de duplicadas.
 */
export const planHowItWorksSteps = [
  {
    step: "01",
    title: "Faça sua simulação",
    description: "Informe os dados básicos do seu negócio e visualize a estimativa mensal.",
  },
  {
    step: "02",
    title: "Converse com a WJB",
    description:
      "Nossa equipe valida as informações e esclarece eventuais particularidades do seu caso.",
  },
  {
    step: "03",
    title: "Envie os documentos",
    description:
      "Você recebe a relação dos documentos e acessos necessários para iniciar o atendimento.",
  },
  {
    step: "04",
    title: "Iniciamos o acompanhamento",
    description:
      "Após a formalização da contratação, a WJB organiza sua rotina contábil e os serviços incluídos no plano.",
  },
];

export const plans: Plan[] = [
  {
    id: "mei",
    name: "MEI",
    slug: "mei",
    startingPrice: 120,
    detailsPath: "/planos/mei",
    simulatorPath: "/planos/simulador?regime=mei",
    cardSummary:
      "Para o microempreendedor que quer manter obrigações organizadas, receber orientação contábil e ter apoio para crescer com segurança.",
    cardHighlights: [
      "DAS-SIMEI",
      "DASN-SIMEI",
      "Orientação contábil e fiscal",
      "Apoio com folha quando aplicável",
      "Atendimento WJB",
    ],
    detail: {
      eyebrow: "PLANO MEI",
      heroTitle: "Contabilidade para MEI com acompanhamento simples e próximo.",
      heroText:
        "Mesmo quando a legislação simplifica as obrigações do MEI, o acompanhamento contábil pode ajudar na organização financeira, comprovação de resultados, cumprimento de prazos e preparação para o crescimento do negócio.",
      heroCta: "Simular Plano MEI",
      whatIsTitle: "O que é MEI?",
      whatIsText: [
        "O Microempreendedor Individual é uma modalidade simplificada destinada a pequenos empreendedores que atendem aos requisitos legais de atividade, faturamento e estrutura previstos para o MEI.",
        "Antes da contratação, a WJB poderá verificar se o perfil do negócio continua compatível com esse enquadramento.",
      ],
      clientResponsibilities: [
        "Enviar documentos e informações dentro dos prazos combinados.",
        "Informar movimentações e alterações do negócio.",
        "Manter os dados cadastrais atualizados.",
        "Comunicar admissões, desligamentos ou alterações trabalhistas antes dos prazos legais.",
        "Conferir e efetuar os pagamentos de tributos e guias encaminhados pela WJB.",
      ],
      wjbServices: [
        {
          title: "DAS-SIMEI",
          description: "Orientação e disponibilização da guia mensal aplicável ao MEI.",
        },
        {
          title: "DASN-SIMEI",
          description:
            "Preparação e entrega da declaração anual conforme dados fornecidos pelo cliente.",
        },
        {
          title: "Escrituração contábil quando contratada/aplicável",
          description:
            "Organização dos registros contábeis e demonstrações necessárias ao escopo contratado.",
        },
        {
          title: "Folha de pagamento",
          description:
            "Rotinas relacionadas ao empregado do MEI, quando houver e quando incluídas no plano.",
        },
        {
          title: "Orientação contábil, fiscal e trabalhista",
          description: "Atendimento para dúvidas relacionadas à rotina da empresa.",
        },
        {
          title: "Suporte WJB",
          description: "Atendimento pelos canais definidos no contrato, inclusive WhatsApp e e-mail.",
        },
        {
          title: "Certificado digital",
          description:
            "Orientação sobre necessidade, emissão e utilização do certificado digital quando aplicável.",
        },
      ],
      finalCta: "Fazer simulação",
    },
  },
  {
    id: "simples",
    name: "Simples Nacional",
    slug: "simples-nacional",
    startingPrice: 350,
    detailsPath: "/planos/simples-nacional",
    simulatorPath: "/planos/simulador?regime=simples",
    cardSummary:
      "Para micro e pequenas empresas que precisam de uma rotina contábil, fiscal e trabalhista organizada em um único acompanhamento.",
    cardHighlights: [
      "Apuração de tributos",
      "Escrituração fiscal",
      "Contabilidade completa",
      "Folha e pró-labore",
      "Obrigações acessórias",
      "Atendimento consultivo",
    ],
    detail: {
      eyebrow: "PLANO SIMPLES NACIONAL",
      heroTitle: "Contabilidade completa para empresas do Simples Nacional.",
      heroText:
        "Uma solução para empresas que precisam manter apurações, registros contábeis, obrigações fiscais e rotinas trabalhistas organizadas com acompanhamento profissional.",
      heroCta: "Simular Plano Simples Nacional",
      whatIsTitle: "O que é Simples Nacional?",
      whatIsText: [
        "O Simples Nacional é um regime tributário voltado a microempresas e empresas de pequeno porte que atendem aos requisitos previstos em lei.",
        "A tributação depende de fatores como atividade, faturamento, folha, anexos aplicáveis e características da operação.",
      ],
      clientResponsibilities: [
        "Enviar documentos fiscais e financeiros.",
        "Informar faturamento e movimentações.",
        "Disponibilizar XMLs e documentos necessários.",
        "Informar movimentações trabalhistas.",
        "Manter certificados e procurações válidos quando necessários.",
        "Pagar tributos e obrigações nos respectivos vencimentos.",
      ],
      wjbServices: [
        {
          title: "Apuração e emissão de tributos",
          description:
            "Cálculo dos tributos e disponibilização das guias aplicáveis ao regime e à atividade da empresa.",
        },
        {
          title: "Escrituração fiscal",
          description:
            "Organização e processamento das informações fiscais, entradas, saídas, serviços prestados e tomados e demais registros exigidos.",
        },
        {
          title: "PGDAS-D e DEFIS",
          description: "Preparação e transmissão conforme aplicabilidade e dados fornecidos.",
        },
        {
          title: "Contabilidade completa",
          description:
            "Escrituração contábil, Livro Diário, Razão, Balanço Patrimonial, DRE e demais demonstrações previstas no escopo.",
        },
        {
          title: "Departamento Pessoal",
          description:
            "Folha, pró-labore, admissões, férias, desligamentos e eventos trabalhistas previstos no contrato.",
        },
        {
          title: "eSocial e demais obrigações",
          description: "Transmissão das obrigações aplicáveis à empresa conforme legislação vigente.",
        },
        {
          title: "Orientação",
          description: "Apoio contábil, fiscal e trabalhista para a rotina do cliente.",
        },
        {
          title: "Atendimento WJB",
          description: "Canais digitais e acompanhamento de acordo com o plano contratado.",
        },
      ],
      finalCta: "Fazer simulação",
    },
  },
  {
    id: "presumido",
    name: "Lucro Presumido",
    slug: "lucro-presumido",
    startingPrice: 700,
    detailsPath: "/planos/lucro-presumido",
    simulatorPath: "/planos/simulador?regime=presumido",
    cardSummary:
      "Para empresas que exigem uma operação fiscal e contábil mais ampla, com acompanhamento das obrigações próprias do Lucro Presumido.",
    cardHighlights: [
      "Tributos federais, estaduais e municipais aplicáveis",
      "Escrituração fiscal",
      "Contabilidade completa",
      "ECD/ECF quando aplicáveis",
      "Folha e obrigações trabalhistas",
      "Atendimento consultivo",
    ],
    detail: {
      eyebrow: "PLANO LUCRO PRESUMIDO",
      heroTitle: "Contabilidade estruturada para empresas no Lucro Presumido.",
      heroText:
        "Acompanhamento contábil e fiscal para empresas que necessitam de apurações periódicas, escriturações completas e controle consistente das obrigações do regime.",
      heroCta: "Simular Plano Lucro Presumido",
      whatIsTitle: "O que é Lucro Presumido?",
      whatIsText: [
        "O Lucro Presumido é um regime em que IRPJ e CSLL são calculados a partir de percentuais de presunção definidos conforme a atividade, além dos demais tributos aplicáveis à operação.",
        "A escolha do regime deve considerar faturamento, atividade, margens, folha, créditos, custos e demais particularidades do negócio.",
      ],
      clientResponsibilities: [
        "Enviar documentos fiscais e financeiros.",
        "Informar faturamento e movimentações.",
        "Disponibilizar XMLs e documentos necessários, com atenção ao volume documental das escriturações.",
        "Informar movimentações trabalhistas.",
        "Manter certificados e procurações válidos quando necessários.",
        "Pagar tributos e obrigações nos respectivos vencimentos.",
      ],
      wjbServices: [
        {
          title: "Apuração tributária",
          description:
            "Cálculo e disponibilização dos tributos federais, estaduais e municipais aplicáveis à operação.",
        },
        {
          title: "Escrituração fiscal",
          description:
            "Entradas, saídas, serviços prestados e tomados e demais registros necessários ao regime e à atividade.",
        },
        {
          title: "Obrigações digitais",
          description:
            "Entrega das escriturações e declarações aplicáveis, incluindo EFDs, DCTFWeb, EFD-Reinf e demais obrigações conforme o caso.",
        },
        {
          title: "Contabilidade completa",
          description:
            "Livro Diário, Razão, Balanço Patrimonial, DRE e demonstrações contábeis previstas no escopo.",
        },
        {
          title: "ECD e ECF",
          description: "Preparação e entrega quando houver obrigatoriedade.",
        },
        {
          title: "Departamento Pessoal",
          description:
            "Folha, pró-labore, admissões, férias, desligamentos, eSocial e obrigações relacionadas.",
        },
        {
          title: "Orientação consultiva",
          description:
            "Apoio à empresa na interpretação de números, obrigações e decisões recorrentes.",
        },
      ],
      finalCta: "Fazer simulação",
    },
  },
];

export function getPlan(id: Regime) {
  return plans.find((plan) => plan.id === id);
}

export function getPlanBySlug(slug: string) {
  return plans.find((plan) => plan.slug === slug);
}

/**
 * Serviços adicionais (seção 6) — reutilizados no card de "Serviços
 * adicionais" da página /planos e no AddonsSelector do simulador.
 */
export const planAddons = [
  {
    id: "invoiceIssuance" as const,
    name: "Emissão assistida de NFS-e",
    description:
      "Apoio operacional para emissão de notas fiscais de serviços conforme as informações fornecidas pela empresa e as regras do município aplicável.",
  },
  {
    id: "fiscalMonitor" as const,
    name: "Monitor Fiscal WJB",
    description:
      "Acompanhamento recorrente de pendências e sinais de risco fiscal, incluindo consultas e verificações disponíveis nos ambientes oficiais aplicáveis ao perfil da empresa. Hoje é um serviço operacional realizado pela equipe WJB, sem automação com portais governamentais.",
  },
];
