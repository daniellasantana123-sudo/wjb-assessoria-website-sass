import type { Metadata } from "next";

import { PlanDetails } from "@/components/plans/PlanDetails";
import { getPlan } from "@/config/plans";

export const metadata: Metadata = {
  alternates: { canonical: "/planos/lucro-presumido" },
  title: "Contabilidade para Lucro Presumido | WJB",
  description:
    "Contabilidade para empresas no Lucro Presumido com escrituração, apuração tributária, obrigações digitais e suporte WJB.",
};

export default function LucroPresumidoPlanPage() {
  const plan = getPlan("presumido")!;
  return <PlanDetails plan={plan} />;
}
