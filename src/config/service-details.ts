/**
 * Conteúdo de conversão das páginas de serviço (2026-11-09, plano comercial
 * aprovado pela WJB, Fase 3). Complementa `service-pages.ts` com o que a
 * página precisa para responder às dúvidas de quem chega pelo Google ou por
 * um anúncio: para quem é, como funciona, documentos e perguntas frequentes.
 *
 * Regras seguidas neste arquivo (seção 43 de Wjb-Website.md):
 * - sem prazos, preços, percentuais de economia ou garantias de resultado -
 *   tudo isso depende de diagnóstico e de órgãos públicos;
 * - documentos e etapas descrevem o processo como ele é no Brasil, não
 *   números da WJB;
 * - o conteúdo técnico deve ser revisado pela WJB antes de virar anúncio
 *   (ver docs/comercial/ARQUITETURA_LANDING_PAGES_WJB.md).
 */

export interface ServiceStep {
  title: string;
  description: string;
}

export interface ServiceFaq {
  question: string;
  answer: string;
}

export interface ServiceDetail {
  /** Parágrafo de abertura, logo abaixo do título. */
  intro: string;
  /** Rótulo do botão principal da página (o que o visitante quer fazer). */
  primaryCta: string;
  /** Mensagem pré-preenchida do WhatsApp para este serviço. */
  whatsappMessage: string;
  audience: string[];
  steps: ServiceStep[];
  /** Documentos ou informações que ajudam a começar. */
  documents?: string[];
  faq: ServiceFaq[];
}

const proposalStep: ServiceStep = {
  title: "Proposta",
  description:
    "Com base no porte, no regime tributário e na rotina da empresa, a WJB apresenta o escopo do atendimento e a proposta.",
};

export const serviceDetails: Record<string, ServiceDetail> = {
  "abrir-empresa": {
    intro:
      "Abrir uma empresa envolve escolher o tipo societário, as atividades (CNAE), o regime tributário e passar por registros em vários órgãos. A WJB orienta cada decisão e conduz o processo, para você começar com a empresa organizada desde o primeiro dia.",
    primaryCta: "Quero abrir minha empresa",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e quero abrir uma empresa. Pode me ajudar?",
    audience: [
      "Quem vai abrir o primeiro CNPJ e quer orientação desde o início.",
      "MEI que cresceu e precisa migrar para outro tipo de empresa.",
      "Sócios que vão formalizar um negócio que já funciona na prática.",
      "Profissionais que querem atuar como pessoa jurídica.",
    ],
    steps: [
      {
        title: "Conversa inicial",
        description:
          "Entendemos a atividade, o faturamento esperado, os sócios e onde a empresa vai funcionar.",
      },
      {
        title: "Planejamento da abertura",
        description:
          "Definimos com você o tipo de empresa, os CNAEs e o regime tributário mais adequado ao seu caso.",
      },
      {
        title: "Viabilidade e registro",
        description:
          "Consultamos a viabilidade do endereço e da atividade, preparamos o ato constitutivo e fazemos o registro.",
      },
      {
        title: "CNPJ e inscrições",
        description:
          "Acompanhamos a emissão do CNPJ e as inscrições municipal e estadual, quando a atividade exigir.",
      },
      {
        title: "Empresa pronta para operar",
        description:
          "Orientamos sobre emissão de notas, obrigações mensais e a rotina contábil a partir do início.",
      },
    ],
    documents: [
      "Documento de identificação e CPF de cada sócio.",
      "Comprovante de endereço residencial dos sócios.",
      "Endereço do local da empresa e, quando houver, o número do IPTU.",
      "Descrição das atividades que a empresa vai exercer.",
      "Capital social e a participação de cada sócio.",
    ],
    faq: [
      {
        question: "Qual é o melhor tipo de empresa para mim?",
        answer:
          "Depende da atividade, do número de sócios e do faturamento esperado. Essa escolha é feita na conversa inicial, junto com a definição do regime tributário.",
      },
      {
        question: "Posso abrir a empresa no endereço da minha casa?",
        answer:
          "Em muitos casos sim, mas depende das regras do município para a atividade. A consulta de viabilidade, feita antes do registro, confirma se o endereço é permitido.",
      },
      {
        question: "Quanto tempo leva para abrir a empresa?",
        answer:
          "Depende dos órgãos envolvidos, do município e da atividade. Na conversa inicial explicamos as etapas do seu caso e acompanhamos cada uma até a conclusão.",
      },
      {
        question: "A WJB continua cuidando da empresa depois da abertura?",
        answer:
          "Sim. Depois da abertura, a WJB pode assumir a contabilidade, o fiscal e o Departamento Pessoal da empresa no dia a dia.",
      },
    ],
  },

  "trocar-de-contador": {
    intro:
      "Trocar de contador é mais simples do que parece. A WJB conduz a transição com o seu contador atual, recebe a documentação e organiza tudo para que a rotina da sua empresa continue sem interrupção.",
    primaryCta: "Solicitar proposta para troca",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e quero trocar de contador. Pode me ajudar?",
    audience: [
      "Empresas insatisfeitas com o atendimento ou a falta de orientação do contador atual.",
      "Empresas que cresceram e precisam de um acompanhamento mais próximo.",
      "Quem quer mais organização, prazos em dia e relatórios para decidir.",
      "Empresas que querem uma contabilidade com processos digitais.",
    ],
    steps: [
      {
        title: "Diagnóstico inicial",
        description:
          "Entendemos a situação da empresa, o regime tributário, a folha e o que precisa de atenção.",
      },
      proposalStep,
      {
        title: "Transição conduzida pela WJB",
        description:
          "Entramos em contato com o contador anterior e recebemos a documentação contábil, fiscal e trabalhista.",
      },
      {
        title: "Conferência e organização",
        description:
          "Conferimos as informações recebidas e apontamos o que precisa ser ajustado.",
      },
      {
        title: "Acompanhamento contínuo",
        description:
          "A empresa passa a ser atendida pela WJB, com rotina mensal organizada e canal direto com a equipe.",
      },
    ],
    documents: [
      "CNPJ e dados de contato da empresa.",
      "Contato do contador atual.",
      "Certificado digital da empresa, quando houver.",
      "Informações sobre funcionários e pró-labore, se a empresa tiver folha.",
    ],
    faq: [
      {
        question: "Posso trocar de contador com a empresa funcionando?",
        answer:
          "Sim. A troca pode ser feita a qualquer momento, e a WJB organiza a transição para que as obrigações da empresa continuem sendo cumpridas.",
      },
      {
        question: "Preciso falar com o meu contador atual?",
        answer:
          "Basta avisar que vai encerrar o contrato, respeitando o aviso previsto nele. A WJB cuida do contato técnico e do recebimento da documentação.",
      },
      {
        question: "O que acontece se houver pendências da gestão anterior?",
        answer:
          "Na conferência, apontamos as pendências encontradas e explicamos as opções para regularizar cada uma.",
      },
      {
        question: "Quando a WJB assume a contabilidade?",
        answer:
          "A data é combinada na proposta, considerando o encerramento com o contador anterior e o calendário de obrigações da empresa.",
      },
    ],
  },

  "contabilidade-completa": {
    intro:
      "Contabilidade completa é a rotina contábil da sua empresa feita todo mês: escrituração, fechamento e demonstrações, com informações claras para você acompanhar a saúde do negócio e decidir melhor.",
    primaryCta: "Solicitar proposta contábil",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e quero uma proposta de contabilidade para a minha empresa.",
    audience: [
      "Empresas do Simples Nacional e do Lucro Presumido.",
      "Empresas que precisam de demonstrações confiáveis para bancos, sócios ou investidores.",
      "Quem quer acompanhar resultado e indicadores com regularidade.",
    ],
    steps: [
      {
        title: "Diagnóstico",
        description:
          "Conhecemos a empresa, o regime tributário e como os documentos chegam hoje.",
      },
      proposalStep,
      {
        title: "Rotina mensal",
        description:
          "Escrituração, conciliações e fechamento do mês com base nos documentos da empresa.",
      },
      {
        title: "Demonstrações e relatórios",
        description:
          "Balancete, balanço, DRE e relatórios que mostram o resultado da empresa.",
      },
      {
        title: "Acompanhamento",
        description:
          "Contato direto com a equipe para dúvidas e para decisões que dependem dos números.",
      },
    ],
    faq: [
      {
        question: "Qual é a diferença entre contabilidade e fiscal?",
        answer:
          "A contabilidade registra e organiza tudo o que acontece na empresa e gera as demonstrações. O fiscal apura os impostos e cumpre as obrigações tributárias. Os dois trabalham juntos.",
      },
      {
        question: "Empresa do Simples Nacional precisa de contabilidade?",
        answer:
          "Sim. A escrituração contábil é exigida das empresas em geral, e as demonstrações ajudam a comprovar resultado, distribuir lucros e conseguir crédito.",
      },
      {
        question: "Como envio os documentos todo mês?",
        answer:
          "Os documentos podem ser enviados pela Área do Cliente da WJB, que também guarda o histórico da empresa.",
      },
    ],
  },

  "fiscal-tributario": {
    intro:
      "A área fiscal cuida da apuração dos impostos e das obrigações acessórias da empresa, no regime tributário em que ela está. O objetivo é manter tudo em dia, evitando multas e pagamentos indevidos.",
    primaryCta: "Solicitar proposta",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e quero saber mais sobre o serviço fiscal e tributário.",
    audience: [
      "Empresas do Simples Nacional e do Lucro Presumido.",
      "Empresas de comércio, serviços e indústria com obrigações estaduais e municipais.",
      "Quem quer conferir se está pagando os impostos corretamente.",
    ],
    steps: [
      {
        title: "Diagnóstico fiscal",
        description:
          "Verificamos o regime, as atividades e as obrigações da empresa.",
      },
      proposalStep,
      {
        title: "Apuração mensal",
        description:
          "Cálculo dos tributos devidos e emissão das guias para pagamento.",
      },
      {
        title: "Obrigações acessórias",
        description:
          "Entrega das declarações e arquivos exigidos pelos órgãos, dentro dos prazos.",
      },
    ],
    faq: [
      {
        question: "Quais impostos vocês apuram?",
        answer:
          "Os tributos do regime da empresa, como Simples Nacional, ISS, ICMS, IPI, PIS, COFINS, IRPJ e CSLL, conforme as atividades exercidas.",
      },
      {
        question: "O que são obrigações acessórias?",
        answer:
          "São declarações e arquivos que a empresa precisa entregar aos órgãos, além de pagar os impostos. Atrasar ou errar essas entregas pode gerar multa.",
      },
      {
        question: "Recebo as guias de impostos todo mês?",
        answer:
          "Sim. As guias e os prazos ficam disponíveis na Área do Cliente da WJB.",
      },
    ],
  },

  "departamento-pessoal": {
    intro:
      "O Departamento Pessoal cuida da folha de pagamento e de toda a rotina trabalhista da empresa, da admissão à rescisão, com as obrigações do eSocial e do FGTS Digital em dia.",
    primaryCta: "Solicitar proposta",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e quero uma proposta de Departamento Pessoal.",
    audience: [
      "Empresas com funcionários registrados.",
      "Empresas que pagam apenas pró-labore aos sócios.",
      "Quem vai fazer a primeira contratação.",
    ],
    steps: [
      {
        title: "Levantamento",
        description:
          "Entendemos o quadro de funcionários, a convenção coletiva e a rotina da empresa.",
      },
      proposalStep,
      {
        title: "Folha mensal",
        description:
          "Cálculo da folha, do pró-labore e dos encargos, com emissão das guias.",
      },
      {
        title: "Eventos do dia a dia",
        description:
          "Admissões, férias, 13º salário e rescisões, com envio ao eSocial.",
      },
    ],
    faq: [
      {
        question: "Vocês cuidam do eSocial?",
        answer:
          "Sim. Os eventos trabalhistas da empresa são enviados ao eSocial como parte da rotina do Departamento Pessoal.",
      },
      {
        question: "Empresa sem funcionários precisa de Departamento Pessoal?",
        answer:
          "Se os sócios recebem pró-labore, há obrigações e encargos a cumprir todo mês, e eles fazem parte da rotina do Departamento Pessoal.",
      },
      {
        question: "Como faço para admitir um funcionário?",
        answer:
          "Envie os dados e os documentos do contratado para a equipe, que orienta o processo e faz o registro.",
      },
    ],
  },

  "planejamento-tributario": {
    intro:
      "Planejamento tributário é a análise, dentro da lei, do regime e da forma de operar da empresa, para que ela pague o que é devido sem excessos e tome decisões com segurança.",
    primaryCta: "Solicitar diagnóstico tributário",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e quero saber mais sobre planejamento tributário.",
    audience: [
      "Empresas que querem saber se estão no regime tributário mais adequado.",
      "Empresas que cresceram e mudaram de faixa de faturamento.",
      "Quem vai abrir uma empresa ou mudar a atividade.",
    ],
    steps: [
      {
        title: "Levantamento",
        description:
          "Reunimos faturamento, despesas, folha e atividades da empresa.",
      },
      {
        title: "Análise",
        description:
          "Comparamos os regimes e as alternativas que a legislação permite para o seu caso.",
      },
      {
        title: "Recomendação",
        description:
          "Apresentamos as opções com os riscos e os cuidados de cada uma.",
      },
      {
        title: "Acompanhamento",
        description:
          "Revisamos o planejamento quando a empresa ou a legislação mudam.",
      },
    ],
    faq: [
      {
        question: "Planejamento tributário é legal?",
        answer:
          "Sim, quando segue a legislação. O planejamento escolhe entre as alternativas que a lei permite, e não envolve esconder receitas ou deixar de pagar impostos.",
      },
      {
        question: "Quando devo fazer o planejamento?",
        answer:
          "Antes de abrir a empresa, na virada do ano, quando o faturamento muda de patamar e sempre que a legislação muda, como na Reforma Tributária.",
      },
      {
        question: "O planejamento garante que vou pagar menos?",
        answer:
          "Não há garantia. O resultado depende da situação da empresa. Em alguns casos a análise confirma que o regime atual já é o mais adequado.",
      },
    ],
  },

  "reforma-tributaria": {
    intro:
      "A Reforma Tributária substitui tributos sobre o consumo por novos impostos, como a CBS e o IBS, em uma transição de vários anos. A WJB acompanha as mudanças e orienta sua empresa a se preparar.",
    primaryCta: "Solicitar avaliação",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e quero entender como a Reforma Tributária afeta a minha empresa.",
    audience: [
      "Empresas que querem entender o impacto da reforma no seu negócio.",
      "Empresas que precisam ajustar sistemas, notas fiscais e preços.",
      "Quem está avaliando o regime tributário para os próximos anos.",
    ],
    steps: [
      {
        title: "Diagnóstico",
        description:
          "Identificamos como as mudanças atingem as atividades e as operações da empresa.",
      },
      {
        title: "Plano de adaptação",
        description:
          "Indicamos os ajustes em processos, cadastros, notas fiscais e regime tributário.",
      },
      {
        title: "Acompanhamento da transição",
        description:
          "Atualizamos as orientações conforme novas regras forem regulamentadas.",
      },
    ],
    faq: [
      {
        question: "Quando a Reforma Tributária começa a valer?",
        answer:
          "A transição é gradual e acontece ao longo de vários anos, com etapas definidas em lei e em regulamentações que ainda estão sendo publicadas.",
      },
      {
        question: "Empresas do Simples Nacional são afetadas?",
        answer:
          "Sim, de forma diferente das demais. Vale avaliar o impacto no seu caso, inclusive em relação aos clientes que compram da sua empresa.",
      },
      {
        question: "Preciso fazer algo agora?",
        answer:
          "É recomendável entender o impacto e preparar processos e sistemas com antecedência. A avaliação mostra o que priorizar.",
      },
    ],
  },

  "certidoes-regularizacao": {
    intro:
      "Pendências fiscais, cadastros irregulares e certidões negativas podem travar contratos, licitações e crédito. A WJB levanta a situação da empresa e conduz a regularização e a emissão de certidões, inclusive a baixa quando a empresa vai encerrar.",
    primaryCta: "Solicitar análise de regularização",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e preciso regularizar a minha empresa.",
    audience: [
      "Empresas com débitos ou declarações em atraso.",
      "Quem precisa de certidões negativas para contratos, licitações ou crédito.",
      "Empresas inativas ou que vão encerrar as atividades.",
    ],
    steps: [
      {
        title: "Levantamento da situação",
        description:
          "Consultamos os órgãos para identificar débitos, declarações em atraso e restrições.",
      },
      {
        title: "Plano de regularização",
        description:
          "Explicamos cada pendência e as alternativas, como parcelamentos previstos em lei.",
      },
      {
        title: "Regularização",
        description:
          "Entregamos o que estiver em atraso e acompanhamos cada pendência até a solução.",
      },
      {
        title: "Certidões ou baixa",
        description:
          "Emitimos as certidões possíveis ou conduzimos o encerramento da empresa.",
      },
    ],
    documents: [
      "CNPJ da empresa.",
      "Certificado digital da empresa, quando houver.",
      "Notificações ou cobranças recebidas dos órgãos, se existirem.",
    ],
    faq: [
      {
        question: "Dá para regularizar uma empresa com muitas pendências?",
        answer:
          "Na maioria dos casos há caminhos, como entregas em atraso e parcelamentos. O levantamento mostra o que existe e as opções para cada pendência.",
      },
      {
        question: "Quanto tempo leva para conseguir a certidão negativa?",
        answer:
          "Depende das pendências e dos órgãos envolvidos. Depois do levantamento, explicamos o caminho do seu caso.",
      },
      {
        question: "Posso fechar uma empresa que tem dívidas?",
        answer:
          "É preciso avaliar cada caso. Explicamos o que acontece com os débitos e os passos do encerramento antes de iniciar a baixa.",
      },
    ],
  },

  "consultoria-contabil": {
    intro:
      "A consultoria contábil vai além das obrigações: analisa números, processos e indicadores da empresa para apoiar decisões contábeis, fiscais e de gestão.",
    primaryCta: "Solicitar proposta",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e quero saber mais sobre consultoria contábil.",
    audience: [
      "Empresários que querem entender os números do negócio.",
      "Empresas em crescimento que precisam organizar processos.",
      "Quem está diante de uma decisão importante, como investir, contratar ou mudar de regime.",
    ],
    steps: [
      {
        title: "Diagnóstico",
        description:
          "Entendemos o momento da empresa e a decisão ou o problema a resolver.",
      },
      {
        title: "Análise",
        description:
          "Avaliamos demonstrações, indicadores, processos e a situação fiscal.",
      },
      {
        title: "Recomendações",
        description:
          "Apresentamos conclusões e próximos passos de forma clara e objetiva.",
      },
    ],
    faq: [
      {
        question: "Preciso ser cliente da contabilidade para contratar a consultoria?",
        answer:
          "Não necessariamente. Conte sua necessidade e indicamos o formato mais adequado.",
      },
      {
        question: "A consultoria é pontual ou contínua?",
        answer:
          "Pode ser das duas formas, conforme a necessidade da empresa.",
      },
    ],
  },

  "recuperacao-tributaria": {
    intro:
      "Empresas podem ter pago tributos a mais ou deixado de aproveitar créditos previstos em lei. A recuperação tributária analisa essa possibilidade e, quando existe, conduz o pedido pelos caminhos legais.",
    primaryCta: "Solicitar análise",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e quero saber se a minha empresa tem tributos a recuperar.",
    audience: [
      "Empresas que suspeitam ter pago impostos indevidamente.",
      "Empresas que mudaram de regime ou de atividade nos últimos anos.",
      "Empresas do Lucro Presumido e do Simples Nacional com operações específicas.",
    ],
    steps: [
      {
        title: "Análise",
        description:
          "Revisamos apurações e pagamentos para identificar se há valores a recuperar.",
      },
      {
        title: "Parecer",
        description:
          "Apresentamos o que foi encontrado, os riscos e o caminho para o pedido.",
      },
      {
        title: "Pedido",
        description:
          "Quando aplicável, conduzimos a compensação ou a restituição pelos meios legais.",
      },
    ],
    faq: [
      {
        question: "Toda empresa tem algo a recuperar?",
        answer:
          "Não. A recuperação só é possível quando houve pagamento indevido ou crédito não aproveitado, e isso só a análise confirma.",
      },
      {
        question: "Quantos anos para trás podem ser analisados?",
        answer:
          "Em regra, a legislação permite pedir valores pagos nos últimos cinco anos. A análise define o período aplicável ao seu caso.",
      },
    ],
  },

  "legalizacao-societario": {
    intro:
      "Mudanças na empresa, como alterar endereço, atividades, capital ou sócios, precisam ser registradas nos órgãos competentes. A WJB prepara a alteração contratual e acompanha o registro.",
    primaryCta: "Solicitar proposta",
    whatsappMessage:
      "Olá! Vim pelo site da WJB e preciso fazer uma alteração na minha empresa.",
    audience: [
      "Empresas que vão mudar de endereço ou de atividades.",
      "Sociedades com entrada ou saída de sócios.",
      "Empresas que vão alterar capital social ou o tipo societário.",
    ],
    steps: [
      {
        title: "Entendimento da mudança",
        description:
          "Identificamos o que muda na empresa e os efeitos no contrato, nos impostos e nas licenças.",
      },
      {
        title: "Alteração contratual",
        description:
          "Preparamos o documento e conferimos as informações com os sócios.",
      },
      {
        title: "Registro e atualizações",
        description:
          "Registramos a alteração e atualizamos os cadastros nos órgãos necessários.",
      },
    ],
    documents: [
      "Contrato social atual e alterações anteriores.",
      "Documentos dos sócios que entram ou saem, quando for o caso.",
      "Novo endereço ou novas atividades, quando for o caso.",
    ],
    faq: [
      {
        question: "Preciso fazer alteração contratual para mudar de endereço?",
        answer:
          "Sim. A mudança de endereço precisa ser registrada e atualizada nos cadastros da empresa, e pode exigir nova consulta de viabilidade.",
      },
      {
        question: "Como funciona a saída de um sócio?",
        answer:
          "É feita uma alteração contratual que registra a saída e a nova divisão das cotas. Orientamos sobre os efeitos para quem sai e para quem fica.",
      },
    ],
  },
};

export function getServiceDetail(slug: string): ServiceDetail | undefined {
  return serviceDetails[slug];
}
