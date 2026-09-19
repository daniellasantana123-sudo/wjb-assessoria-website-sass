import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  Building2,
  Calculator,
  FileCheck2,
  FileSignature,
  Landmark,
  LineChart,
  PiggyBank,
  ReceiptText,
  Target,
  Users2,
} from "lucide-react";

import { type PageImage } from "@/config/images";

export interface ServicePage {
  slug: string;
  title: string;
  category: string;
  shortDescription: string;
  includes: string[];
  note?: string;
  /** Quando definido, embute o LeadForm na página com este contexto (seção 19). */
  leadFormContext?: string;
  /** WJB_Assets_Imagens_V1.md, seção 6 — 1600×1067 para todas. */
  image: PageImage;
  icon: LucideIcon;
}

/**
 * Conteúdo de cada landing page de serviço — seção 32 (FASE 4, ordem de
 * prioridade) e seção 16 (bullets reais de cada categoria) de Wjb-Website.md.
 * Cada bullet do doc aparece em uma única página (sem duplicar entre páginas).
 * Nada aqui é inventado: frases como "quando aplicável" foram preservadas.
 */
export const servicePages: ServicePage[] = [
  {
    slug: "abrir-empresa",
    title: "Abrir Empresa",
    category: "Societário e Legalização",
    shortDescription:
      "Abra sua empresa com orientação sobre CNAE, registro e legalização, do início ao fim.",
    includes: ["Abertura", "CNAE", "Endereço", "Registro", "Inscrições"],
    leadFormContext: "Abrir Empresa",
    image: {
      src: "/images/services/open-company.webp",
      alt: "Consultora e cliente assinando documento de abertura de empresa no escritório da WJB, com livros sobre abertura de empresa e planejamento tributário na mesa",
      width: 1600,
      height: 1067,
    },
    icon: Building2,
  },
  {
    slug: "trocar-de-contador",
    title: "Trocar de Contador",
    category: "Societário e Legalização",
    shortDescription:
      "A WJB conduz a transição com o seu contador atual, sem burocracia para você.",
    includes: ["Diagnóstico inicial", "Transição conduzida pela WJB", "Onboarding"],
    leadFormContext: "Trocar de Contador",
    image: {
      src: "/images/services/change-accountant.webp",
      alt: "Consultora da WJB cumprimentando cliente com aperto de mãos, com pastas 'Transição Contábil' e 'Documentos' na mesa",
      width: 1600,
      height: 1067,
    },
    icon: ArrowRightLeft,
  },
  {
    slug: "contabilidade-completa",
    title: "Contabilidade Completa",
    category: "Contabilidade",
    shortDescription:
      "Escrituração, fechamento e demonstrações contábeis com clareza para decidir.",
    includes: [
      "Escrituração",
      "Fechamento mensal",
      "Balancete",
      "Balanço",
      "DRE",
      "Diário",
      "Razão",
      "Demonstrações",
      "Conciliações",
      "Relatórios",
    ],
    image: {
      src: "/images/services/full-accounting.webp",
      alt: "Consultora da WJB analisando relatórios financeiros com dois clientes, com gráficos exibidos em tela ao fundo",
      width: 1600,
      height: 1067,
    },
    icon: Calculator,
  },
  {
    slug: "fiscal-tributario",
    title: "Fiscal e Tributário",
    category: "Fiscal e Tributário",
    shortDescription: "Apuração e obrigações fiscais em dia, no seu regime tributário.",
    includes: [
      "Apuração",
      "Simples Nacional",
      "Lucro Presumido",
      "ISS",
      "ICMS",
      "IPI",
      "PIS/COFINS",
      "IRPJ/CSLL",
      "SPED",
      "Obrigações acessórias",
    ],
    note: "Lucro Real quando efetivamente atendido.",
    image: {
      src: "/images/services/tax-accounting.webp",
      alt: "Consultor da WJB revisando situação fiscal com cliente, com painel de tributos e conformidade exibido em tela ao fundo",
      width: 1600,
      height: 1067,
    },
    icon: ReceiptText,
  },
  {
    slug: "departamento-pessoal",
    title: "Departamento Pessoal",
    category: "Departamento Pessoal",
    shortDescription: "Folha, admissões e obrigações trabalhistas sem dor de cabeça.",
    includes: [
      "Folha",
      "Pró-labore",
      "Admissões",
      "Férias",
      "Rescisões",
      "13º",
      "eSocial",
      "FGTS Digital",
      "Encargos",
      "Suporte",
    ],
    image: {
      src: "/images/services/payroll-hr.webp",
      alt: "Consultora da WJB apresentando documento de folha de pagamento a cliente",
      width: 1600,
      height: 1067,
    },
    icon: Users2,
  },
  {
    slug: "planejamento-tributario",
    title: "Planejamento Tributário",
    category: "Fiscal e Tributário",
    shortDescription:
      "Planejamento tributário para organizar a carga fiscal da sua empresa com segurança.",
    includes: ["Planejamento"],
    image: {
      src: "/images/services/tax-planning.webp",
      alt: "Consultora e cliente da WJB analisando planejamento tributário, com painel de indicadores exibido em tela ao fundo",
      width: 1600,
      height: 1067,
    },
    icon: Target,
  },
  {
    slug: "reforma-tributaria",
    title: "Reforma Tributária",
    category: "Fiscal e Tributário",
    shortDescription:
      "Acompanhamos a Reforma Tributária de perto para adaptar sua empresa com segurança.",
    includes: ["Reforma tributária"],
    image: {
      src: "/images/services/tax-reform.webp",
      alt: "Consultora da WJB apresentando painel sobre a Reforma Tributária a dois clientes em tela grande",
      width: 1600,
      height: 1067,
    },
    icon: Landmark,
  },
  {
    slug: "certidoes-regularizacao",
    title: "Certidões e Regularização",
    category: "Societário e Legalização",
    shortDescription:
      "Certidões e regularização da sua empresa perante os órgãos competentes.",
    includes: ["Certidões", "Baixa"],
    image: {
      src: "/images/services/compliance-regularization.webp",
      alt: "Consultora da WJB mostrando certidão negativa de débitos a cliente, com painel de situação das certidões regularizadas em tela ao fundo",
      width: 1600,
      height: 1067,
    },
    icon: FileCheck2,
  },
  {
    slug: "consultoria-contabil",
    title: "Consultoria",
    category: "Consultoria",
    shortDescription:
      "Diagnóstico e apoio gerencial contábil, fiscal e tributário para decisões melhores.",
    includes: [
      "Contábil",
      "Fiscal",
      "Tributária",
      "Diagnósticos",
      "Indicadores",
      "Processos",
      "Apoio gerencial",
    ],
    image: {
      src: "/images/services/accounting-consulting.webp",
      alt: "Consultora da WJB apresentando indicadores e gráficos de gestão a cliente",
      width: 1600,
      height: 1067,
    },
    icon: LineChart,
  },
  {
    slug: "recuperacao-tributaria",
    title: "Recuperação Tributária",
    category: "Fiscal e Tributário",
    shortDescription: "Recuperação tributária quando aplicável ao seu caso.",
    includes: ["Recuperação tributária"],
    note: "Aplicável conforme diagnóstico da situação fiscal da sua empresa.",
    image: {
      src: "/images/services/tax-recovery.webp",
      alt: "Consultora e cliente analisando documentos em escritório da WJB, com painel de recuperação tributária exibido em tela ao fundo",
      width: 1600,
      height: 1067,
    },
    icon: PiggyBank,
  },
  {
    slug: "legalizacao-societario",
    title: "Legalização e Societário",
    category: "Societário e Legalização",
    shortDescription: "Alterações societárias e transformações com segurança jurídica.",
    includes: ["Alteração", "Transformação", "Entrada e saída de sócios"],
    image: {
      src: "/images/services/corporate-legalization.webp",
      alt: "Consultora da WJB entregando documento societário a cliente, com livros de contratos e legislação societária na mesa",
      width: 1600,
      height: 1067,
    },
    icon: FileSignature,
  },
];

export function getServicePage(slug: string) {
  return servicePages.find((service) => service.slug === slug);
}
