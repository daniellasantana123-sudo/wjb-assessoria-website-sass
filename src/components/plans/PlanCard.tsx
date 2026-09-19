import Link from "next/link";
import { Check } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { formatBRL } from "@/config/pricing";
import type { Plan } from "@/config/plans";

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className="border-border hover:-translate-y-1 hover:shadow-md flex h-full flex-col gap-5 rounded-md border p-6 transition-all duration-200">
      <div>
        <h3 className="text-foreground text-lg font-semibold">{plan.name}</h3>
        <p className="text-muted-foreground mt-2 text-sm">{plan.cardSummary}</p>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {plan.cardHighlights.map((item) => (
          <li key={item} className="text-foreground flex items-start gap-2 text-sm">
            <Check aria-hidden="true" className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      <div className="border-border border-t pt-4">
        <p className="text-muted-foreground text-xs">A partir de</p>
        <p className="text-foreground text-2xl font-semibold">
          {formatBRL(plan.startingPrice)}
          <span className="text-muted-foreground text-sm font-normal"> / mês</span>
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <Link href={plan.detailsPath} className={buttonVariants({ variant: "outline" })}>
            Saiba mais
          </Link>
          <Link
            href={plan.simulatorPath}
            className={buttonVariants({ variant: "cta" })}
          >
            Simular este plano
          </Link>
        </div>
      </div>
    </div>
  );
}
