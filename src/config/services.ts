import type { LucideIcon } from "lucide-react";
import { Calculator, FileSignature, LineChart, ReceiptText, Users2 } from "lucide-react";

export interface ServiceCategory {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

/** Categorias de serviço — seção 16 de Wjb-Website.md, rotas da seção 13 (sitemap). */
export const serviceCategories: ServiceCategory[] = [
  {
    title: "Contabilidade",
    description: "Escrituração, fechamento mensal, balancete, DRE e demonstrações.",
    href: "/servicos/contabilidade-completa",
    icon: Calculator,
  },
  {
    title: "Fiscal e Tributário",
    description: "Apuração, obrigações acessórias, SPED e planejamento tributário.",
    href: "/servicos/fiscal-tributario",
    icon: ReceiptText,
  },
  {
    title: "Departamento Pessoal",
    description: "Folha, admissões, férias, rescisões, eSocial e FGTS Digital.",
    href: "/servicos/departamento-pessoal",
    icon: Users2,
  },
  {
    title: "Societário e Legalização",
    description: "Abertura, alteração, entrada e saída de sócios, certidões e baixa.",
    href: "/servicos/legalizacao-societario",
    icon: FileSignature,
  },
  {
    title: "Consultoria",
    description: "Diagnósticos, indicadores e apoio gerencial contábil e tributário.",
    href: "/servicos/consultoria-contabil",
    icon: LineChart,
  },
];
