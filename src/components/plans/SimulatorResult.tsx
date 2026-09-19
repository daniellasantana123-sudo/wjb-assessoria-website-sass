import Link from "next/link";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { formatBRL } from "@/config/pricing";
import { headerCtas } from "@/config/navigation";
import type { Plan } from "@/config/plans";
import type { PriceEstimate } from "@/types/pricing";

export interface SimulatorResultProps {
  plan: Plan;
  estimate: PriceEstimate;
  onContract: () => void;
  onShowIncluded: () => void;
}

/**
 * Card de resultado. Quando `estimate.requiresCustomQuote` é true (perfil
 * marcado como "PROPOSTA PERSONALIZADA" na planilha oficial da WJB), não
 * mostra valor fechado - só o plano recomendado como ponto de partida e um
 * CTA para falar com a WJB.
 */
export function SimulatorResult({ plan, estimate, onContract, onShowIncluded }: SimulatorResultProps) {
  if (estimate.requiresCustomQuote) {
    return (
      <div className="border-border sticky top-24 flex flex-col gap-5 rounded-md border p-6">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">
          SUA SIMULAÇÃO
        </p>
        <div>
          <p className="text-foreground text-lg font-semibold">
            Sua empresa precisa de uma análise personalizada
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {estimate.customQuoteReason} Nossa equipe precisa analisar alguns detalhes antes
            de definir o melhor plano contábil para o seu caso.
          </p>
        </div>

        <p className="text-muted-foreground text-xs">
          Plano de partida: {plan.name} (a partir de {formatBRL(estimate.basePrice)}/mês) - o
          valor final depende da análise da WJB.
        </p>

        <div className="flex flex-col gap-2">
          <Button type="button" variant="cta" onClick={onContract}>
            Solicitar proposta personalizada
          </Button>
          <Link
            href={headerCtas.talkToAccountant.href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Falar com um especialista
          </Link>
          <Button type="button" variant="ghost" onClick={onShowIncluded}>
            Veja o que está incluso
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border sticky top-24 flex flex-col gap-5 rounded-md border p-6">
      <p className="text-primary text-sm font-medium tracking-wide uppercase">
        SUA SIMULAÇÃO
      </p>
      <div>
        <p className="text-foreground text-lg font-semibold">Plano recomendado</p>
        <p className="text-foreground text-sm">{plan.name}</p>
        <p aria-live="polite" className="text-foreground mt-2 text-2xl font-semibold">
          {formatBRL(estimate.amount)} / mês
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          Sua estimativa considera regime tributário, faturamento informado, quantidade de
          empregados, estrutura societária e serviços adicionais escolhidos.
        </p>
      </div>

      <p className="text-muted-foreground text-xs">
        Este valor é uma estimativa baseada nas informações fornecidas. O valor final poderá
        variar após análise cadastral, fiscal, tributária e operacional da empresa.
      </p>

      <div className="flex flex-col gap-2">
        <Button type="button" variant="cta" onClick={onContract}>
          Quero falar com a WJB
        </Button>
        <Link
          href={headerCtas.talkToAccountant.href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          Falar com contador
        </Link>
        <Button type="button" variant="ghost" onClick={onShowIncluded}>
          Veja o que está incluso
        </Button>
      </div>
    </div>
  );
}
