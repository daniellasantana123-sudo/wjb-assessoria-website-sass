export interface FaqItem {
  question: string;
  answer: string;
  href?: string;
  linkLabel?: string;
}

/**
 * WJB_Conteudos_Incompletos_Implementacao_Claude.md, seção 11 (2026-08-30).
 */
export const faqItems: FaqItem[] = [
  {
    question: "A WJB atende empresas fora de São Paulo?",
    answer:
      "Sim. Grande parte dos processos contábeis pode ser realizada digitalmente. A viabilidade e o formato do atendimento são avaliados de acordo com o serviço e a necessidade da empresa.",
  },
  {
    question: "Posso trocar de contador mesmo com a empresa em funcionamento?",
    answer:
      "Sim. A troca pode ser organizada sem interromper a operação da empresa. A WJB orienta o processo de transição e a transferência das informações necessárias.",
    href: "/servicos/trocar-de-contador",
    linkLabel: "Ver como funciona",
  },
  {
    question: "A WJB ajuda na abertura de empresas?",
    answer:
      "Sim. Orientamos o processo de abertura, enquadramento e legalização de acordo com a atividade e a estrutura do negócio.",
    href: "/servicos/abrir-empresa",
    linkLabel: "Conhecer o serviço",
  },
  {
    question: "Vocês trabalham com Simples Nacional?",
    answer:
      "Sim. A WJB atende empresas enquadradas no Simples Nacional e também avalia a situação tributária conforme o perfil e a legislação aplicável.",
  },
  {
    question: "A WJB faz planejamento tributário?",
    answer:
      "Sim. O planejamento é realizado a partir da realidade da empresa, considerando operação, regime tributário, legislação e cenários possíveis.",
    href: "/servicos/planejamento-tributario",
    linkLabel: "Ver o serviço",
  },
  {
    question: "A WJB oferece Departamento Pessoal?",
    answer:
      "Sim. Entre os serviços estão rotinas de folha, admissões, desligamentos, férias e obrigações trabalhistas e previdenciárias, conforme o contrato.",
    href: "/servicos/departamento-pessoal",
    linkLabel: "Ver o serviço",
  },
  {
    question: "O atendimento é somente digital?",
    answer:
      "Não. A WJB utiliza processos digitais para ganhar eficiência, mantendo atendimento humano e consultivo. O formato pode variar conforme a necessidade do cliente.",
    href: "/contabilidade-digital",
    linkLabel: "Conhecer a Contabilidade Digital",
  },
  {
    question: "Como solicito uma proposta?",
    answer:
      "Acesse a página de contato, envie o formulário ou fale diretamente conosco pelo WhatsApp.",
    href: "/contato",
    linkLabel: "Ir para Contato",
  },
];
