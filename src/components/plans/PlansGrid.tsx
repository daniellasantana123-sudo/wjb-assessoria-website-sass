import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { plans } from "@/config/plans";

import { PlanCard } from "./PlanCard";

export function PlansGrid() {
  return (
    <RevealStagger className="grid grid-cols-1 gap-6 lg:grid-cols-3" itemClassName="h-full">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </RevealStagger>
  );
}
