import type { Metadata } from "next";

import { PlanDetails } from "@/components/plans/PlanDetails";
import { getPlan } from "@/config/plans";

export const metadata: Metadata = {
  title: "Contabilidade para MEI | Plano MEI WJB",
  description:
    "Conheça o Plano MEI da WJB, veja o que está incluído e simule o valor mensal para manter seu negócio organizado.",
};

export default function MeiPlanPage() {
  const plan = getPlan("mei")!;
  return <PlanDetails plan={plan} />;
}
