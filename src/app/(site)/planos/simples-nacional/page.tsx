import type { Metadata } from "next";

import { PlanDetails } from "@/components/plans/PlanDetails";
import { getPlan } from "@/config/plans";

export const metadata: Metadata = {
  alternates: { canonical: "/planos/simples-nacional" },
  title: "Contabilidade para Simples Nacional | WJB",
  description:
    "Plano contábil para empresas do Simples Nacional com apuração fiscal, contabilidade, folha e atendimento consultivo.",
};

export default function SimplesNacionalPlanPage() {
  const plan = getPlan("simples")!;
  return <PlanDetails plan={plan} />;
}
