export interface Testimonial {
  id: number | string;
  name: string;
  role: string;
  quote: string;
  initials?: string;
  image?: string;
  fictional?: boolean;
}

/**
 * WJB_Depoimentos_Carrossel_Fotos_Footer_Claude_FINAL.md (2026-08-31) — os 8
 * depoimentos abaixo são fictícios, conteúdo demonstrativo pra validar o
 * layout do carrossel (`fictional: true`), com fotos de perfil geradas por
 * IA (ver `docs/design/images.md`). Nome, cargo, texto e foto não
 * correspondem a nenhum cliente real da WJB. Sem estrelas, nota, logo de
 * cliente ou JSON-LD Review/AggregateRating. Nome da empresa deliberadamente
 * ausente (pedido explícito do documento).
 *
 * 2026-09-14: a pedido explícito do usuário (reafirmado após alerta sobre o
 * risco), o selo "Depoimentos ilustrativos" foi removido da UI
 * (`src/components/sections/testimonials.tsx`) mesmo o conteúdo continuando
 * fictício — usuário classificou como "placeholders aprovados internamente"
 * pela WJB. `fictional: true` continua marcado em cada item (não é mais
 * exibido em nenhum lugar, mas documenta a natureza real do dado pra quem
 * mexer neste arquivo depois). Quando a WJB fornecer depoimentos reais e
 * autorizados, substituir os itens abaixo e remover `fictional`.
 */
export const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Mariana Costa",
    role: "Sócia-diretora",
    quote:
      "O que mais valorizo é a clareza nas orientações. A equipe consegue transformar assuntos contábeis e fiscais em informações fáceis de entender, o que ajuda muito na hora de tomar decisões para a empresa.",
    initials: "MC",
    image: "/images/testimonials/mariana-costa.png",
    fictional: true,
  },
  {
    id: 2,
    name: "Rafael Mendes",
    role: "Fundador e Diretor Executivo",
    quote:
      "Precisávamos de uma contabilidade mais próxima do negócio e com respostas rápidas. A experiência com a WJB trouxe mais acompanhamento, organização e uma comunicação que facilita muito a rotina da empresa.",
    initials: "RM",
    image: "/images/testimonials/rafael-mendes.png",
    fictional: true,
  },
  {
    id: 3,
    name: "Juliana Rocha",
    role: "Diretora Administrativa",
    quote:
      "Ter uma equipe acompanhando obrigações, prazos e documentos traz muito mais segurança para a gestão. Isso permite que a nossa atenção fique concentrada no atendimento aos clientes e no crescimento da operação.",
    initials: "JR",
    image: "/images/testimonials/juliana-rocha.png",
    fictional: true,
  },
  {
    id: 4,
    name: "Carlos Henrique Lima",
    role: "Sócio-administrador",
    quote:
      "A combinação entre contabilidade e tecnologia faz diferença para empresas que querem ganhar eficiência. Processos mais digitais, informações organizadas e acesso rápido ao suporte tornam o dia a dia muito mais simples.",
    initials: "CH",
    image: "/images/testimonials/carlos-henrique-lima.png",
    fictional: true,
  },
  {
    id: 5,
    name: "Patrícia Alves",
    role: "Gestora Financeira",
    quote:
      "Buscávamos um parceiro que não cuidasse apenas das obrigações, mas que também ajudasse a interpretar os números da empresa. Ter informações contábeis organizadas melhora o planejamento e dá mais confiança para decidir.",
    initials: "PA",
    image: "/images/testimonials/patricia-alves.png",
    fictional: true,
  },
  {
    id: 6,
    name: "André Martins",
    role: "Diretor de Operações",
    quote:
      "A transição de contador foi conduzida de forma organizada e sem impacto na operação. Recebemos orientação em cada etapa e atenção aos documentos, prazos e responsabilidades envolvidas.",
    initials: "AM",
    image: "/images/testimonials/andre-martins.png",
    fictional: true,
  },
  {
    id: 7,
    name: "Fernanda Ribeiro",
    role: "Empreendedora e Fundadora",
    quote:
      "Para quem está fazendo a empresa crescer, é muito importante ter alguém que explique o que precisa ser feito e quais são os próximos passos. A clareza e a facilidade para falar com a equipe fazem toda a diferença.",
    initials: "FR",
    image: "/images/testimonials/fernanda-ribeiro.png",
    fictional: true,
  },
  {
    id: 8,
    name: "Lucas Ferreira",
    role: "Sócio e Diretor Comercial",
    quote:
      "A contabilidade precisa acompanhar a velocidade da empresa. O atendimento consultivo, organizado e acessível da WJB ajuda a manter a operação regular e também oferece suporte para as decisões do dia a dia.",
    initials: "LF",
    image: "/images/testimonials/lucas-ferreira.png",
    fictional: true,
  },
];
